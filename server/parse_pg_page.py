import struct

def parse_page():
    filepath = '/var/lib/postgresql/15/main/base/16389/16461'
    try:
        with open(filepath, 'rb') as f:
            page = f.read(8192)
    except Exception as e:
        print(f"Error: {e}")
        return

    # Page Header (24 bytes)
    # pd_lsn (8 bytes), pd_checksum (2 bytes), pd_flags (2 bytes), pd_lower (2 bytes), pd_upper (2 bytes), pd_special (2 bytes)
    pd_lower, pd_upper = struct.unpack('<HH', page[12:16])
    print(f"Page Header: pd_lower={pd_lower}, pd_upper={pd_upper}")
    
    # Line pointers (ItemIdData) start at byte 24 and go up to pd_lower
    num_items = (pd_lower - 24) // 4
    print(f"Number of items in page: {num_items}")
    
    items = []
    for i in range(num_items):
        offset = 24 + i * 4
        item_bytes = page[offset:offset+4]
        val = struct.unpack('<I', item_bytes)[0]
        # lp_off: bits 0-14 (offset to tuple)
        # lp_flags: bits 15-16 (1: unused, 2: normal, 3: redirect)
        # lp_len: bits 17-31 (length of tuple)
        lp_off = val & 0x7fff
        lp_flags = (val >> 15) & 0x3
        lp_len = (val >> 17) & 0x7fff
        items.append((i + 1, lp_off, lp_flags, lp_len))
        print(f"Item {i+1}: lp_off={lp_off} (0x{lp_off:x}), lp_flags={lp_flags}, lp_len={lp_len}")

    # Now let's parse each tuple
    for item_id, lp_off, lp_flags, lp_len in items:
        if lp_flags == 0 or lp_off == 0:
            continue
        
        # Tuple header starts at lp_off
        tuple_bytes = page[lp_off:lp_off+lp_len]
        if len(tuple_bytes) < 23:
            continue
        
        t_xmin = struct.unpack('<I', tuple_bytes[0:4])[0]
        t_xmax = struct.unpack('<I', tuple_bytes[4:8])[0]
        t_cid_xvac = struct.unpack('<I', tuple_bytes[8:12])[0]
        # t_ctid is 6 bytes (block/offset)
        t_infomask2 = struct.unpack('<H', tuple_bytes[18:20])[0]
        t_infomask = struct.unpack('<H', tuple_bytes[20:22])[0]
        t_hoff = tuple_bytes[22]
        
        # Data starts at lp_off + t_hoff
        data_bytes = tuple_bytes[t_hoff:]
        
        # Check if this might be Lautaro
        is_lautaro = b'Lautaro' in data_bytes
        
        print(f"\nTuple {item_id}: offset=0x{lp_off:x}, len={lp_len}, xmin={t_xmin}, xmax={t_xmax}, hoff={t_hoff}, infomask=0x{t_infomask:x}, infomask2=0x{t_infomask2:x}")
        if is_lautaro:
            print(">>> FOUND LAUTARO TUPLE <<<")
            print("Raw Tuple Bytes (80 bytes):")
            for j in range(0, len(tuple_bytes), 16):
                line = tuple_bytes[j:j+16]
                hex_line = ' '.join(f'{b:02x}' for b in line)
                ascii_line = ''.join(chr(b) if 32 <= b < 127 else '.' for b in line)
                print(f'  +{j:02d}: {hex_line:<48} | {ascii_line}')
            
            # Dump the raw bytes of the data
            hex_data = ' '.join(f'{b:02x}' for b in data_bytes)
            ascii_data = ''.join(chr(b) if 32 <= b < 127 else '.' for b in data_bytes)
            print(f"Data Hex: {hex_data}")
            print(f"Data Ascii: {ascii_data}")
            
            # Print individual fields:
            # Let's decode fields manually
            offset = 0
            
            # 1. ID: int4 (4 bytes)
            if offset + 4 <= len(data_bytes):
                p_id = struct.unpack('<i', data_bytes[offset:offset+4])[0]
                offset += 4
                print(f"Field 1 (id): {p_id}")
            
            # 2. Name: varlena text
            # Varlena header: if 1-byte header, length is stored in high 7 bits and low bit is 1.
            # e.g., length = (b >> 1).
            if offset < len(data_bytes):
                b = data_bytes[offset]
                if b & 1:
                    name_len = (b >> 1) - 1  # subtract header byte
                    p_name = data_bytes[offset+1:offset+1+name_len].decode('utf-8', errors='replace')
                    offset += 1 + name_len
                else:
                    # 4-byte header
                    name_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2) - 4
                    p_name = data_bytes[offset+4:offset+4+name_len].decode('utf-8', errors='replace')
                    offset += 4 + name_len
                print(f"Field 2 (name): '{p_name}'")
                
            # 3. Gender: varlena text
            if offset < len(data_bytes):
                b = data_bytes[offset]
                if b & 1:
                    gender_len = (b >> 1) - 1
                    p_gender = data_bytes[offset+1:offset+1+gender_len].decode('utf-8', errors='replace')
                    offset += 1 + gender_len
                else:
                    gender_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2) - 4
                    p_gender = data_bytes[offset+4:offset+4+gender_len].decode('utf-8', errors='replace')
                    offset += 4 + gender_len
                print(f"Field 3 (gender): '{p_gender}'")
                
            # 4. birthDate: timestamptz (8 bytes, needs to be 8-byte aligned)
            # Align offset to 8-byte boundary relative to data start (or block start? relative to start of tuple data)
            # hoff is the offset from start of tuple, so data start is at lp_off + hoff.
            # Let's align offset such that lp_off + hoff + offset is multiple of 8
            actual_offset = lp_off + t_hoff + offset
            align_padding = (8 - (actual_offset % 8)) % 8
            offset += align_padding
            
            if offset + 8 <= len(data_bytes):
                microseconds = struct.unpack('<q', data_bytes[offset:offset+8])[0]
                offset += 8
                # PostgreSQL epoch is 2000-01-01 00:00:00 UTC
                # Let's convert to datetime
                import datetime
                epoch = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
                birth_date = epoch + datetime.timedelta(microseconds=microseconds)
                print(f"Field 4 (birthDate): {birth_date.isoformat()} (raw: {microseconds})")
                
            # 5. height: numeric
            # PostgreSQL numeric is a struct:
            # uint16 ndigits
            # int16 weight
            # uint16 sign
            # uint16 dscale
            # NumericDigit digits[] (each digit is a uint16 base 10000)
            # Let's align to 2-byte boundary
            actual_offset = lp_off + t_hoff + offset
            align_padding = (2 - (actual_offset % 2)) % 2
            offset += align_padding
            
            # Let's write a small helper to parse numeric
            def parse_numeric(data_bytes, offset):
                if offset + 8 > len(data_bytes):
                    return None, offset
                
                # Check for varlena header of numeric
                header_byte = data_bytes[offset]
                # If short varlena header
                if header_byte & 1:
                    num_len = (header_byte >> 1)
                    # The numeric header and digits are inside
                    numeric_data = data_bytes[offset+1 : offset+num_len]
                    offset += num_len
                else:
                    num_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2)
                    numeric_data = data_bytes[offset+4 : offset+num_len]
                    offset += num_len
                
                if len(numeric_data) < 8:
                    return None, offset
                
                ndigits, weight, sign, dscale = struct.unpack('>HHHH', numeric_data[0:8])
                # Note: PG numeric header is big-endian or native? On disk it is big endian! (Network byte order)
                # Let's verify with the bytes. Let's unpack both big-endian and little-endian
                # and print them to be safe
                return (ndigits, weight, sign, dscale, numeric_data[8:]), offset
            
            numeric_info, offset = parse_numeric(data_bytes, offset)
            print(f"Field 5 (height): {numeric_info}")
            
            # 6. targetWeight: numeric
            # Align to 2-byte boundary
            actual_offset = lp_off + t_hoff + offset
            align_padding = (2 - (actual_offset % 2)) % 2
            offset += align_padding
            target_weight_info, offset = parse_numeric(data_bytes, offset)
            print(f"Field 6 (targetWeight): {target_weight_info}")
            
            # 7. targetBodyFat: numeric
            actual_offset = lp_off + t_hoff + offset
            align_padding = (2 - (actual_offset % 2)) % 2
            offset += align_padding
            target_body_fat_info, offset = parse_numeric(data_bytes, offset)
            print(f"Field 7 (targetBodyFat): {target_body_fat_info}")
            
            # 8. createdAt: timestamptz (8-byte aligned)
            actual_offset = lp_off + t_hoff + offset
            align_padding = (8 - (actual_offset % 8)) % 8
            offset += align_padding
            if offset + 8 <= len(data_bytes):
                microseconds = struct.unpack('<q', data_bytes[offset:offset+8])[0]
                offset += 8
                import datetime
                epoch = datetime.datetime(2000, 1, 1, tzinfo=datetime.timezone.utc)
                created_at = epoch + datetime.timedelta(microseconds=microseconds)
                print(f"Field 8 (createdAt): {created_at.isoformat()} (raw: {microseconds})")
                
            # 9. trainingProfile: varlena text
            if offset < len(data_bytes):
                b = data_bytes[offset]
                if b & 1:
                    tp_len = (b >> 1) - 1
                    p_tp = data_bytes[offset+1:offset+1+tp_len].decode('utf-8', errors='replace')
                    offset += 1 + tp_len
                else:
                    tp_len = (struct.unpack('<I', data_bytes[offset:offset+4])[0] >> 2) - 4
                    p_tp = data_bytes[offset+4:offset+4+tp_len].decode('utf-8', errors='replace')
                    offset += 4 + tp_len
                print(f"Field 9 (trainingProfile): '{p_tp}'")
            else:
                print("Field 9 (trainingProfile): None/Empty")

parse_page()
