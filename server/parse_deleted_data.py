import struct
import os
import datetime

# PostgreSQL Epoch
epoch = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)

def parse_numeric(data_bytes, offset):
    if offset >= len(data_bytes):
        return None, offset
    
    header_byte = data_bytes[offset]
    if header_byte & 1:
        num_len = (header_byte >> 1)
        numeric_data = data_bytes[offset+1 : offset+num_len]
        offset += num_len
    else:
        if offset + 4 > len(data_bytes):
            return None, len(data_bytes)
        num_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2)
        numeric_data = data_bytes[offset+4 : offset+num_len]
        offset += num_len
        
    if len(numeric_data) < 4:
        return None, offset
        
    # Unpack short numeric
    # The first 2 bytes are header, remainder are digits
    n_header = struct.unpack('<H', numeric_data[0:2])[0]
    is_short = (n_header & 0x8000) != 0
    if is_short:
        sign = (n_header & 0x4000) != 0 # 1 if negative
        dscale = (n_header >> 8) & 0x3f
        weight = (n_header & 0xff) - 0x80
        digits = []
        for j in range(2, len(numeric_data), 2):
            if j + 2 <= len(numeric_data):
                digits.append(struct.unpack('<H', numeric_data[j:j+2])[0])
        
        # Calculate value
        val = 0
        for idx, dig in enumerate(digits):
            val += dig * (10000 ** (weight - idx))
        if dscale > 0:
            val = val / (10 ** dscale)
        if sign:
            val = -val
        return val, offset
    else:
        # Standard numeric
        # Not needed if all values are short, but let's return raw for safety
        return f"StandardNumeric({numeric_data.hex()})", offset

def parse_text(data_bytes, offset):
    if offset >= len(data_bytes):
        return None, offset
    b = data_bytes[offset]
    if b & 1:
        val_len = (b >> 1) - 1
        val = data_bytes[offset+1 : offset+1+val_len].decode('utf-8', errors='replace')
        offset += 1 + val_len
    else:
        val_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2) - 4
        val = data_bytes[offset+4 : offset+4+val_len].decode('utf-8', errors='replace')
        offset += 4 + val_len
    return val, offset

def parse_timestamptz(data_bytes, offset, lp_off, t_hoff):
    actual_offset = lp_off + t_hoff + offset
    align_padding = (8 - (actual_offset % 8)) % 8
    offset += align_padding
    if offset + 8 <= len(data_bytes):
        micros = struct.unpack('<q', data_bytes[offset:offset+8])[0]
        offset += 8
        dt = epoch + datetime.timedelta(microseconds=micros)
        return dt, offset
    return None, offset

def scan_table(filepath, tablename):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return
        
    with open(filepath, 'rb') as f:
        data = f.read()
        
    num_pages = len(data) // 8192
    print(f"\nScanning table {tablename} ({num_pages} pages)...")
    
    for page_idx in range(num_pages):
        page = data[page_idx*8192 : (page_idx+1)*8192]
        pd_lower, pd_upper = struct.unpack('<HH', page[12:16])
        num_items = (pd_lower - 24) // 4
        
        for i in range(num_items):
            val = struct.unpack('<I', page[24 + i*4 : 28 + i*4])[0]
            lp_off = val & 0x7fff
            lp_flags = (val >> 15) & 0x3
            lp_len = (val >> 17) & 0x7fff
            
            if lp_flags == 0 or lp_off == 0 or lp_len == 0:
                continue
                
            tuple_bytes = page[lp_off : lp_off+lp_len]
            if len(tuple_bytes) < 23:
                continue
                
            t_xmin = struct.unpack('<I', tuple_bytes[0:4])[0]
            t_xmax = struct.unpack('<I', tuple_bytes[4:8])[0]
            t_hoff = tuple_bytes[22]
            
            data_bytes = tuple_bytes[t_hoff:]
            if len(data_bytes) < 5:
                continue
                
            # Column 1: id (int4) -> 4 bytes
            # Column 2: profileId (text) -> starts at offset 4
            try:
                # Check if profileId is '1'.
                # A 1-byte string '1' starts with 0x05 followed by 0x31 ('1')
                if data_bytes[4] == 0x05 and data_bytes[5] == 0x31:
                    print(f"  FOUND tuple in {tablename}: item_id={i+1}, offset=0x{lp_off:x}, len={lp_len}, xmin={t_xmin}, xmax={t_xmax}")
                    print(f"    Raw hex: {data_bytes.hex()}")
                    decode_tuple(tablename, data_bytes, lp_off, t_hoff)
            except Exception as e:
                pass

def decode_tuple(tablename, data_bytes, lp_off, t_hoff):
    # Decode helper based on table schema
    try:
        offset = 0
        p_id = struct.unpack('<i', data_bytes[offset:offset+4])[0]
        offset += 4
        profile_id, offset = parse_text(data_bytes, offset)
        
        if tablename == 'measurements':
            # Schema: id, profileId, timestamp, weight, impedance, bmi, bmr, bodyFat, bodyWater, boneMass, muscleMass, visceralFat, metabolicAge, protein, bodyType
            timestamp, offset = parse_timestamptz(data_bytes, offset, lp_off, t_hoff)
            # Remaining are numerics
            metrics = []
            for name in ["weight", "impedance", "bmi", "bmr", "bodyFat", "bodyWater", "boneMass", "muscleMass", "visceralFat", "metabolicAge", "protein", "bodyType"]:
                # Align to 2 bytes for numeric
                actual_offset = lp_off + t_hoff + offset
                align_padding = (2 - (actual_offset % 2)) % 2
                offset += align_padding
                val, offset = parse_numeric(data_bytes, offset)
                metrics.append(f"{name}={val}")
            print(f"    DECODED: id={p_id}, profileId={profile_id}, timestamp={timestamp}, {', '.join(metrics)}")
            
        elif tablename == 'workout_logs':
            # Schema: id, profileId, timestamp, type, description, duration, caloriesBurned, distanceKm, avgHeartRate, maxHeartRate, source, externalId
            timestamp, offset = parse_timestamptz(data_bytes, offset, lp_off, t_hoff)
            w_type, offset = parse_text(data_bytes, offset)
            desc, offset = parse_text(data_bytes, offset)
            # Numerics
            numerics = []
            for name in ["duration", "caloriesBurned", "distanceKm", "avgHeartRate", "maxHeartRate"]:
                actual_offset = lp_off + t_hoff + offset
                align_padding = (2 - (actual_offset % 2)) % 2
                offset += align_padding
                val, offset = parse_numeric(data_bytes, offset)
                numerics.append(f"{name}={val}")
            # Text columns
            source, offset = parse_text(data_bytes, offset)
            ext_id, offset = parse_text(data_bytes, offset)
            print(f"    DECODED: id={p_id}, profileId={profile_id}, timestamp={timestamp}, type={w_type}, desc={desc}, {', '.join(numerics)}, source={source}, ext_id={ext_id}")
            
        elif tablename == 'food_logs':
            # Schema: id, profileId, timestamp, mealType, description, calories, protein, carbs, fat
            timestamp, offset = parse_timestamptz(data_bytes, offset, lp_off, t_hoff)
            meal_type, offset = parse_text(data_bytes, offset)
            desc, offset = parse_text(data_bytes, offset)
            # Numerics
            numerics = []
            for name in ["calories", "protein", "carbs", "fat"]:
                actual_offset = lp_off + t_hoff + offset
                align_padding = (2 - (actual_offset % 2)) % 2
                offset += align_padding
                val, offset = parse_numeric(data_bytes, offset)
                numerics.append(f"{name}={val}")
            print(f"    DECODED: id={p_id}, profileId={profile_id}, timestamp={timestamp}, meal={meal_type}, desc={desc}, {', '.join(numerics)}")
            
        elif tablename == 'messages':
            # Schema: id, profileId, timestamp, sender, content
            timestamp, offset = parse_timestamptz(data_bytes, offset, lp_off, t_hoff)
            sender, offset = parse_text(data_bytes, offset)
            content, offset = parse_text(data_bytes, offset)
            print(f"    DECODED: id={p_id}, profileId={profile_id}, timestamp={timestamp}, sender={sender}, content={content}")
            
        elif tablename == 'workout_sets':
            # Schema: id, workoutLogId, profileId, exerciseName, setNumber, reps, weight, timestamp, notes, distanceKm, duration, speed
            # Wait, let's verify if schema differs for workout_sets:
            # Table schema in index.js for select/insert:
            # Let's inspect column order
            pass
            
    except Exception as e:
        print(f"    Error decoding: {e}")

def main():
    base_dir = '/var/lib/postgresql/15/main/'
    tables = {
        'measurements': base_dir + 'base/16389/16471',
        'food_logs': base_dir + 'base/16389/16481',
        'workout_logs': base_dir + 'base/16389/16491',
        'messages': base_dir + 'base/16389/16501',
        'workout_sets': base_dir + 'base/16389/16513',
        'user_exercises': base_dir + 'base/16389/16523'
    }
    
    for tname, path in tables.items():
        scan_table(path, tname)

if __name__ == '__main__':
    main()
