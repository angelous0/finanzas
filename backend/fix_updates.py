"""Fix critical UPDATE/DELETE statements to include empresa_id."""
import re

GLOBAL_TABLES = ['cont_empresa', 'cont_moneda', 'cont_tipo_cambio']

with open('/app/backend/server.py', 'r') as f:
    lines = f.readlines()

fixed = 0

for i in range(len(lines)):
    line = lines[i]
    
    # Match: UPDATE/DELETE ... WHERE id = $N"
    for pattern_type in ['UPDATE', 'DELETE FROM']:
        match = re.search(
            rf'({pattern_type}\s+finanzas2\.(cont_\w+).*?WHERE\s+id\s*=\s*\$(\d+))"',
            line
        )
        if not match:
            continue
        
        table = match.group(2)
        param_num = int(match.group(3))
        
        if table in GLOBAL_TABLES:
            continue
        if 'empresa_id' in line:
            continue
        
        # Add AND empresa_id = $N+1
        next_param = param_num + 1
        old_pattern = f'WHERE id = ${param_num}"'
        new_pattern = f'WHERE id = ${param_num} AND empresa_id = ${next_param}"'
        
        if old_pattern in line:
            new_line = line.replace(old_pattern, new_pattern, 1)
            
            # Add empresa_id to params
            # Find closing ) on this or next lines
            if new_line.rstrip().endswith(')'):
                stripped = new_line.rstrip()
                new_line = stripped[:-1] + ', empresa_id)\n'
                lines[i] = new_line
                fixed += 1
            elif '", ' in new_line:
                # Params follow on same line
                old_end = new_line.rstrip()
                if old_end.endswith(')'):
                    lines[i] = old_end[:-1] + ', empresa_id)\n'
                    fixed += 1
                else:
                    lines[i] = new_line
                    # Find closing ) on next line
                    for j in range(i+1, min(len(lines), i+5)):
                        if lines[j].rstrip().endswith(')'):
                            lines[j] = lines[j].rstrip()[:-1] + ', empresa_id)\n'
                            fixed += 1
                            break
            else:
                lines[i] = new_line
                # Find closing ) on next line
                for j in range(i+1, min(len(lines), i+5)):
                    if lines[j].rstrip().endswith(')'):
                        lines[j] = lines[j].rstrip()[:-1] + ', empresa_id)\n'
                        fixed += 1
                        break
    
    # Also fix dynamic UPDATE queries: f"UPDATE ... WHERE id = ${idx}"
    match = re.search(r'(f"UPDATE\s+finanzas2\.(cont_\w+).*?WHERE\s+.*?id\s*=\s*\$\{idx\})', line)
    if match and 'empresa_id' not in line:
        table = match.group(2)
        if table not in GLOBAL_TABLES:
            # These already have empresa_id in WHERE from earlier fixes
            pass

with open('/app/backend/server.py', 'w') as f:
    f.writelines(lines)

print(f"Fixed {fixed} UPDATE/DELETE WHERE id queries")
