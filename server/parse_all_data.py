import struct
import datetime
import json
import os
import sys

# Allow large integer to string conversion
sys.set_int_max_str_digits(1000000)

epoch = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)

def parse_numeric(data, offset, lp_off, t_hoff):
    if offset >= len(data):
        return None, offset
    
    header_byte = data[offset]
    if header_byte & 1:
        # Short varlena: no alignment padding.
        num_len = (header_byte >> 1)
        numeric_data = data[offset+1 : offset+num_len]
        offset += num_len
    else:
        # Long varlena: align to 4 bytes.
        actual_offset = lp_off + t_hoff + offset
        align_padding = (4 - (actual_offset % 4)) % 4
        offset += align_padding
        if offset + 4 > len(data):
            return None, len(data)
        num_len = (struct.unpack('<I', data[offset:offset+4])[0] >> 2)
        numeric_data = data[offset+4 : offset+num_len]
        offset += num_len
        
    if len(numeric_data) < 2:
        return None, offset
        
    n_header = struct.unpack('<H', numeric_data[0:2])[0]
    
    if (n_header & 0xC000) == 0x8000:
        is_negative = (n_header & 0x2000) != 0
        dscale = (n_header & 0x1F80) >> 7
        weight = n_header & 0x003F
        if n_header & 0x0040:
            weight -= 0x0040
            
        if abs(weight) > 20: # Sanity check for exponent
            return None, offset
            
        digits = []
        for j in range(2, len(numeric_data), 2):
            if j + 2 <= len(numeric_data):
                digits.append(struct.unpack('<H', numeric_data[j:j+2])[0])
                
        val = 0
        for idx, dig in enumerate(digits):
            val += dig * (10000 ** (weight - idx))
        if is_negative:
            val = -val
        return val, offset
    else:
        if len(numeric_data) < 4:
            return None, offset
        n_sign_dscale = n_header
        n_weight = struct.unpack('<h', numeric_data[2:4])[0]
        
        if abs(n_weight) > 20: # Sanity check for exponent
            return None, offset
            
        is_negative = (n_sign_dscale & 0xC000) == 0x4000
        digits = []
        for j in range(4, len(numeric_data), 2):
            if j + 2 <= len(numeric_data):
                digits.append(struct.unpack('<H', numeric_data[j:j+2])[0])
        val = 0
        for idx, dig in enumerate(digits):
            val += dig * (10000 ** (n_weight - idx))
        if is_negative:
            val = -val
        return val, offset


def parse_text(data, offset, lp_off, t_hoff):
    if offset >= len(data):
        return None, offset
    b = data[offset]
    if b & 1:
        # Short varlena: no alignment padding.
        val_len = (b >> 1) - 1
        val = data[offset+1 : offset+1+val_len].decode('utf-8', errors='replace')
        offset += 1 + val_len
    else:
        # Long varlena: align to 4 bytes.
        actual_offset = lp_off + t_hoff + offset
        align_padding = (4 - (actual_offset % 4)) % 4
        offset += align_padding
        if offset + 4 > len(data):
            return None, len(data)
        val_len = (struct.unpack('<I', data[offset:offset+4])[0] >> 2) - 4
        val = data[offset+4 : offset+4+val_len].decode('utf-8', errors='replace')
        offset += 4 + val_len
    return val, offset

def parse_timestamptz(data, offset, lp_off, t_hoff):
    actual_offset = lp_off + t_hoff + offset
    align_padding = (8 - (actual_offset % 8)) % 8
    offset += align_padding
    if offset + 8 <= len(data):
        micros = struct.unpack('<q', data[offset:offset+8])[0]
        offset += 8
        dt = epoch + datetime.timedelta(microseconds=micros)
        return dt.isoformat(), offset
    return None, offset

def parse_int4(data, offset, lp_off, t_hoff):
    actual_offset = lp_off + t_hoff + offset
    align_padding = (4 - (actual_offset % 4)) % 4
    offset += align_padding
    if offset + 4 <= len(data):
        val = struct.unpack('<i', data[offset:offset+4])[0]
        offset += 4
        return val, offset
    return None, offset

schemas = {
    'user_profiles': [
        ('id', 'int4'),
        ('name', 'text'),
        ('gender', 'text'),
        ('birthDate', 'timestamptz'),
        ('height', 'numeric'),
        ('targetWeight', 'numeric'),
        ('targetBodyFat', 'numeric'),
        ('createdAt', 'timestamptz'),
        ('trainingProfile', 'text')
    ],
    'measurements': [
        ('id', 'int4'),
        ('profileId', 'text'),
        ('timestamp', 'timestamptz'),
        ('weight', 'numeric'),
        ('impedance', 'numeric'),
        ('bmi', 'numeric'),
        ('bmr', 'numeric'),
        ('bodyFat', 'numeric'),
        ('bodyWater', 'numeric'),
        ('boneMass', 'numeric'),
        ('muscleMass', 'numeric'),
        ('visceralFat', 'numeric'),
        ('metabolicAge', 'numeric'),
        ('protein', 'numeric'),
        ('bodyType', 'numeric')
    ],
    'messages': [
        ('id', 'int4'),
        ('profileId', 'text'),
        ('timestamp', 'timestamptz'),
        ('sender', 'text'),
        ('content', 'text')
    ],
    'user_exercises': [
        ('id', 'int4'),
        ('profileId', 'text'),
        ('name', 'text'),
        ('machineDetails', 'text'),
        ('lastUsed', 'timestamptz')
    ],
    'food_logs': [
        ('id', 'int4'),
        ('profileId', 'text'),
        ('timestamp', 'timestamptz'),
        ('mealType', 'text'),
        ('description', 'text'),
        ('calories', 'numeric'),
        ('protein', 'numeric'),
        ('carbs', 'numeric'),
        ('fat', 'numeric')
    ],
    'workout_logs': [
        ('id', 'int4'),
        ('profileId', 'text'),
        ('timestamp', 'timestamptz'),
        ('type', 'text'),
        ('description', 'text'),
        ('duration', 'numeric'),
        ('caloriesBurned', 'numeric'),
        ('distanceKm', 'numeric'),
        ('avgHeartRate', 'numeric'),
        ('maxHeartRate', 'numeric'),
        ('source', 'text'),
        ('externalId', 'text')
    ],
    'workout_sets': [
        ('id', 'int4'),
        ('workoutLogId', 'text'),
        ('profileId', 'text'),
        ('exerciseName', 'text'),
        ('setNumber', 'int4'),
        ('reps', 'numeric'),
        ('weight', 'numeric'),
        ('timestamp', 'timestamptz'),
        ('notes', 'text'),
        ('distanceKm', 'numeric'),
        ('duration', 'numeric'),
        ('speed', 'numeric')
    ]
}

def parse_tuple(tablename, tuple_bytes, lp_off, t_hoff):
    t_infomask2 = struct.unpack('<H', tuple_bytes[18:20])[0]
    t_infomask = struct.unpack('<H', tuple_bytes[20:22])[0]
    
    num_attrs = t_infomask2 & 0x07FF
    has_null = (t_infomask & 0x0001) != 0
    
    bitmap_size = (num_attrs + 7) // 8 if has_null else 0
    null_bitmap = tuple_bytes[23 : 23 + bitmap_size] if has_null else b''
    
    data = tuple_bytes[t_hoff:]
    offset = 0
    result = {}
    
    schema = schemas[tablename]
    for col_idx, (col_name, col_type) in enumerate(schema):
        # If the column index exceeds the stored number of attributes in this tuple (e.g. older schema version)
        if col_idx >= num_attrs:
            result[col_name] = None
            continue
            
        # Check if null
        if has_null:
            byte_idx = col_idx // 8
            bit_idx = col_idx % 8
            if byte_idx < len(null_bitmap):
                is_present = (null_bitmap[byte_idx] & (1 << bit_idx)) != 0
                if not is_present:
                    result[col_name] = None
                    continue
            else:
                result[col_name] = None
                continue
                
        # Parse value
        if col_type == 'int4':
            val, offset = parse_int4(data, offset, lp_off, t_hoff)
        elif col_type == 'text':
            val, offset = parse_text(data, offset, lp_off, t_hoff)
        elif col_type == 'timestamptz':
            val, offset = parse_timestamptz(data, offset, lp_off, t_hoff)
        elif col_type == 'numeric':
            val, offset = parse_numeric(data, offset, lp_off, t_hoff)
        else:
            val = None
            
        result[col_name] = val
        
    return result

def scan_table_file(filepath, tablename):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return []
        
    with open(filepath, 'rb') as f:
        data = f.read()
        
    num_pages = len(data) // 8192
    results = []
    
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
            
            try:
                row = parse_tuple(tablename, tuple_bytes, lp_off, t_hoff)
                row['_xmin'] = t_xmin
                row['_xmax'] = t_xmax
                row['_is_deleted'] = (t_xmax != 0)
                results.append(row)
            except Exception as e:
                # print(f"Error parsing {tablename} item {i+1} at page {page_idx}: {e}")
                pass
                
    return results

def main():
    base_dir = '/var/lib/postgresql/15/main/'
    paths = {
        'user_profiles': base_dir + 'base/16389/16461',
        'measurements': base_dir + 'base/16389/16471',
        'messages': base_dir + 'base/16389/16501',
        'user_exercises': base_dir + 'base/16389/16523',
        'workout_logs': base_dir + 'base/16389/16491',
        'workout_sets': base_dir + 'base/16389/16513',
        'food_logs': base_dir + 'base/16389/16481'
    }
    
    output = {}
    for table, path in paths.items():
        rows = scan_table_file(path, table)
        # Filter for Lautaro (profile ID 1)
        if table == 'user_profiles':
            filtered = [r for r in rows if r['id'] == 1]
        else:
            filtered = [r for r in rows if str(r.get('profileId')) == '1']
        output[table] = filtered
        
    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
