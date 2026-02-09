"""
Fix empresa_id param position mismatch.
Issue: empresa_id added as LAST column but FIRST param.
Fix: Move empresa_id from first to last in the params for affected INSERTs.
"""
import re

with open('/app/backend/server.py', 'r') as f:
    lines = f.readlines()

fixed = 0

for i in range(len(lines)):
    line = lines[i]
    if 'INSERT INTO finanzas2.cont_' in line and 'cont_empresa' not in line and 'cont_moneda' not in line:
        # Collect block to find column list
        block = ''.join(lines[i:min(len(lines), i+10)])
        
        # Check if empresa_id is LAST in column list (not first)
        # Pattern: something, empresa_id)\n ... VALUES
        if re.search(r',\s*empresa_id\s*\)\s*\n', block):
            # empresa_id is LAST column - find the params line
            for k in range(i+1, min(len(lines), i+15)):
                if '""",' in lines[k]:
                    param_text = lines[k]
                    # Check if empresa_id is FIRST param (right after """,)
                    if '""", empresa_id,' in param_text:
                        # Remove empresa_id from first position
                        lines[k] = param_text.replace('""", empresa_id,', '""",', 1)
                        
                        # Find the LAST param line (ends with ))
                        for m in range(k, min(len(lines), k + 5)):
                            stripped = lines[m].rstrip()
                            if stripped.endswith(')'):
                                # Add empresa_id before the closing )
                                lines[m] = stripped[:-1] + ', empresa_id)\n'
                                fixed += 1
                                break
                        break
                    break

with open('/app/backend/server.py', 'w') as f:
    f.writelines(lines)

print(f"Fixed {fixed} param position mismatches")
