"""Fix params for all INSERT statements that have empresa_id in columns but not in params."""
import re

with open('/app/backend/server.py', 'r') as f:
    lines = f.readlines()

fixed = 0

for i in range(len(lines)):
    line = lines[i]
    if 'INSERT INTO finanzas2.cont_' in line and 'cont_empresa' not in line and 'cont_moneda' not in line:
        # Collect block to check if empresa_id is in columns
        block = ''.join(lines[i:min(len(lines), i+15)])
        
        if ', empresa_id' not in block:
            continue
        
        # Find the """, params...) line
        for k in range(i+1, min(len(lines), i+15)):
            if '""",' in lines[k]:
                # Check if empresa_id already in params
                # Collect all param lines until closing )
                param_block = lines[k].split('""",', 1)[1]
                m = k + 1
                while m < len(lines) and ')' not in param_block:
                    param_block += lines[m]
                    m += 1
                
                if 'empresa_id' in param_block:
                    break  # Already has it
                
                # Add empresa_id after """,
                old = lines[k]
                # Insert empresa_id right after """,
                parts = old.split('""",', 1)
                lines[k] = parts[0] + '""", empresa_id,' + parts[1]
                fixed += 1
                break

with open('/app/backend/server.py', 'w') as f:
    f.writelines(lines)

print(f"Fixed {fixed} param lines")
