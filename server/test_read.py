import struct

def main():
    filepath = '/var/lib/postgresql/15/main/base/16389/16461'
    with open(filepath, 'rb') as f:
        page = f.read(8192)
        
    pd_lower, pd_upper = struct.unpack('<HH', page[12:16])
    val = struct.unpack('<I', page[24:28])[0]
    lp_off = val & 0x7fff
    lp_len = (val >> 17) & 0x7fff
    tuple_bytes = page[lp_off : lp_off+lp_len]
    
    t_xmin = struct.unpack('<I', tuple_bytes[0:4])[0]
    t_xmax = struct.unpack('<I', tuple_bytes[4:8])[0]
    t_infomask2 = struct.unpack('<H', tuple_bytes[18:20])[0]
    t_infomask = struct.unpack('<H', tuple_bytes[20:22])[0]
    t_hoff = tuple_bytes[22]
    
    print('lp_off:', hex(lp_off), 'lp_len:', lp_len)
    print('t_xmin:', t_xmin)
    print('t_xmax:', t_xmax)
    print('t_infomask2:', hex(t_infomask2))
    print('t_infomask:', hex(t_infomask))
    print('t_hoff:', t_hoff)
    print('null_bitmap:', bin(tuple_bytes[23]))
    data = tuple_bytes[t_hoff:]

    print('data hex:', data.hex())

if __name__ == '__main__':
    main()
