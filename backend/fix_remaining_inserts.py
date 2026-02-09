"""
Fix remaining INSERT statements by adding empresa_id as LAST column/value.
This avoids shifting $N placeholders (much safer).
"""
import re

GLOBAL_TABLES = ['cont_empresa', 'cont_moneda', 'cont_tipo_cambio']

with open('/app/backend/server.py', 'r') as f:
    content = f.read()

# Find all INSERT patterns that don't have empresa_id
pattern = r'(INSERT INTO finanzas2\.(cont_\w+)\s*\n\s*\()([^)]+)(\)\s*\n\s*VALUES\s*\()([^)]+)(\))'

def fix_insert(match):
    full = match.group(0)
    table = match.group(2)
    cols = match.group(3)
    vals = match.group(5)
    
    # Skip global tables
    if table in GLOBAL_TABLES:
        return full
    
    # Skip if already has empresa_id
    if 'empresa_id' in cols:
        return full
    
    # Count existing $N to find the next number
    placeholders = re.findall(r'\$(\d+)', vals)
    if placeholders:
        max_n = max(int(p) for p in placeholders)
    else:
        max_n = 0
    
    next_n = max_n + 1
    
    # Add empresa_id
    new_cols = cols.rstrip() + ', empresa_id'
    new_vals = vals.rstrip() + f', ${next_n}'
    
    result = full.replace(cols, new_cols, 1).replace(vals, new_vals, 1)
    return result

new_content = re.sub(pattern, fix_insert, content)

# Count changes
old_count = len(re.findall(r'INSERT INTO finanzas2\.cont_\w+', content))
new_empresa_count = new_content.count('empresa_id')
old_empresa_count = content.count('empresa_id')

print(f"Total INSERTs found: {old_count}")
print(f"empresa_id occurrences: {old_empresa_count} -> {new_empresa_count} (added {new_empresa_count - old_empresa_count})")

# Now fix the params - add empresa_id to the end of each fixed INSERT's params
# We need to find lines that end with `, $N)` where the INSERT was just fixed
# and add empresa_id to the params on the next line(s)

# This is trickier - let's handle it by finding the closing """, ...) pattern
# For each INSERT we fixed, the params follow on the line after """

lines = new_content.split('\n')
fixed_params = 0

for i in range(len(lines)):
    line = lines[i].strip()
    
    # Check if this line has a closing paren of VALUES with our new empresa_id placeholder
    # Pattern: Values end with ", $N)" where we added the placeholder
    match = re.search(r', \$(\d+)\)$', line)
    if match and 'empresa_id' not in line:
        # Check if this is a VALUES line (look back to find VALUES keyword)
        found_values = False
        for j in range(max(0, i-3), i):
            if 'VALUES' in lines[j]:
                found_values = True
                break
        
        if not found_values:
            continue
        
        # Check the context - we need the actual column list to contain 'empresa_id'
        for j in range(max(0, i-5), i):
            if 'empresa_id' in lines[j] and 'INSERT' in ''.join(lines[max(0,j-3):j+1]):
                # This is one of our fixed INSERTs
                # Find the closing line with params
                # Look forward from VALUES closing for the """, params line
                for k in range(i, min(len(lines), i+5)):
                    if '"""' in lines[k]:
                        # Params might be on this line or next
                        param_line = lines[k]
                        if '""",' in param_line:
                            # Add empresa_id before the closing paren
                            # Pattern: ..., last_param)
                            param_line = param_line.rstrip()
                            if param_line.endswith(')'):
                                param_line = param_line[:-1] + ', empresa_id)'
                                lines[k] = param_line + '\n'
                                fixed_params += 1
                        elif k + 1 < len(lines):
                            # Params on next line
                            next_param = lines[k+1].rstrip()
                            if next_param.endswith(')'):
                                next_param = next_param[:-1] + ', empresa_id)'
                                lines[k+1] = next_param + '\n'
                                fixed_params += 1
                        break
                break

new_content = '\n'.join(lines)

print(f"Fixed {fixed_params} param lines")

with open('/app/backend/server.py', 'w') as f:
    f.write(new_content)
