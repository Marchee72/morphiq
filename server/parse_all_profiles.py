import struct
import datetime

def parse_numeric(data, offset):
    if offset >= len(data):
        return None, offset
    
    header_byte = data[offset]
    # Check if short varlena header
    if header_byte & 1:
        num_len = (header_byte >> 1)
        numeric_data = data[offset+1 : offset+num_len]
        offset += num_len
    else:
        # 4-byte header
        if offset + 4 > len(data):
            return None, len(data)
        num_len = (struct.unpack('<I', data[offset:offset+4])[0] >> 2)
        numeric_data = data[offset+4 : offset+num_len]
        offset += num_len
    
    return numeric_data, offset

def main():
    filepath = '/var/lib/postgresql/15/main/base/16389/16461'
    with open(filepath, 'rb') as f:
        page = f.read(8192)
        
    pd_lower, pd_upper = struct.unpack('<HH', page[12:16])
    num_items = (pd_lower - 24) // 4
    
    print(f"{'ID':<3} | {'Name':<15} | {'Gender':<6} | {'Birth Date':<10} | {'Status':<8} | {'Raw Numeric & Remainder Hex'}")
    print("-" * 100)
    
    for i in range(num_items):
        val = struct.unpack('<I', page[24 + i * 4 : 28 + i * 4])[0]
        lp_off = val & 0x7fff
        lp_flags = (val >> 15) & 0x3
        lp_len = (val >> 17) & 0x7fff
        
        if lp_flags == 0 or lp_off == 0:
            continue
            
        tuple_bytes = page[lp_off:lp_off+lp_len]
        t_xmin = struct.unpack('<I', tuple_bytes[0:4])[0]
        t_xmax = struct.unpack('<I', tuple_bytes[4:8])[0]
        t_hoff = tuple_bytes[22]
        
        data_bytes = tuple_bytes[t_hoff:]
        
        # 1. ID
        p_id = struct.unpack('<i', data_bytes[0:4])[0]
        offset = 4
        
        # 2. Name
        b = data_bytes[offset]
        if b & 1:
            name_len = (b >> 1) - 1
            p_name = data_bytes[offset+1:offset+1+name_len].decode('utf-8', errors='replace')
            offset += 1 + name_len
        else:
            name_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2) - 4
            p_name = data_bytes[offset+4:offset+4+name_len].decode('utf-8', errors='replace')
            offset += 4 + name_len
            
        # 3. Gender
        b = data_bytes[offset]
        if b & 1:
            gender_len = (b >> 1) - 1
            p_gender = data_bytes[offset+1:offset+1+gender_len].decode('utf-8', errors='replace')
            offset += 1 + gender_len
        else:
            gender_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2) - 4
            p_gender = data_bytes[offset+4:offset+4+gender_len].decode('utf-8', errors='replace')
            offset += 4 + gender_len
            
        # 4. birthDate
        actual_offset = lp_off + t_hoff + offset
        align_padding = (8 - (actual_offset % 8)) % 8
        offset += align_padding
        
        microseconds = struct.unpack('<q', data_bytes[offset:offset+8])[0]
        offset += 8
        epoch = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
        birth_date = epoch + datetime.timedelta(microseconds=microseconds)
        
        status = "Active" if t_xmax == 0 else f"Deleted(x:{t_xmax})"
        
        # The remainder contains: height, targetWeight, targetBodyFat, createdAt, trainingProfile
        remainder = data_bytes[offset:]
        remainder_hex = ' '.join(f'{b:02x}' for b in remainder)
        
        print(f"{p_id:<3} | {p_name:<15} | {p_gender:<6} | {birth_date.strftime('%Y-%m-%d'):<10} | {status:<8} | {remainder_hex}")

if __name__ == '__main__':
    main()
