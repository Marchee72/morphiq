import sys

def main():
    filepath = '/var/lib/postgresql/15/main/base/16389/16461'
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
    except Exception as e:
        print(f"Error opening file: {e}")
        return

    idx = data.find(b'Lautaro')
    if idx == -1:
        print("Lautaro not found in raw data.")
        return
        
    print(f"Found 'Lautaro' at offset: {idx} (0x{idx:x})")
    
    # Let's inspect the page layout. PostgreSQL pages are 8KB. 
    # Let's dump the 8KB page containing the index.
    page_start = (idx // 8192) * 8192
    print(f"Page start: {page_start}")
    
    # We want to print hex dump of the region containing the tuple.
    # In PostgreSQL, tuples are stored from the bottom of the page upwards,
    # and page headers (with tuple pointers) are stored at the top of the page downwards.
    # Let's dump the region around the match.
    start = max(page_start, idx - 128)
    end = min(page_start + 8192, idx + 128)
    chunk = data[start:end]
    
    for i in range(0, len(chunk), 16):
        offset = start + i
        line = chunk[i:i+16]
        hex_str = ' '.join(f'{b:02x}' for b in line)
        ascii_str = ''.join(chr(b) if 32 <= b < 127 else '.' for b in line)
        print(f'{offset:04x} (offset {offset - page_start:04x}): {hex_str:<48} | {ascii_str}')

if __name__ == '__main__':
    main()
