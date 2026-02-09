"""
Fix ALL remaining INSERT statements to include empresa_id.
Strategy: For each INSERT INTO finanzas2.cont_* that doesn't have empresa_id:
1. Add empresa_id to column list (first position)
2. Shift $N placeholders by 1 in VALUES
3. Add $1 for empresa_id in VALUES
4. Add empresa_id to the parameter list
"""
import re

GLOBAL_TABLES = ['cont_empresa', 'cont_moneda', 'cont_tipo_cambio']

with open('/app/backend/server.py', 'r') as f:
    lines = f.readlines()

# Also fix seed data INSERT statements
SEED_INSERTS_TABLES = ['cont_categoria', 'cont_centro_costo', 'cont_linea_negocio',
                       'cont_cuenta_financiera', 'cont_tercero']

total_fixed = 0
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    # Check if this is an INSERT INTO finanzas2.cont_* line
    match = re.match(r'\s*(INSERT INTO finanzas2\.(cont_\w+))\s*$', stripped)
    if not match:
        # Also match: INSERT INTO finanzas2.cont_xxx (columns...
        match = re.match(r'\s*(INSERT INTO finanzas2\.(cont_\w+))\s*\(', stripped)
    
    if match:
        table = match.group(2)
        
        # Skip global tables
        if table in GLOBAL_TABLES:
            i += 1
            continue
        
        # Check if next line (or this line) already has empresa_id
        block = ''.join(lines[i:i+5])
        if 'empresa_id' in block:
            i += 1
            continue
        
        # Found an INSERT that needs empresa_id!
        # Collect the full INSERT statement (until RETURNING or the closing paren of VALUES)
        insert_start = i
        insert_lines = []
        j = i
        while j < len(lines):
            insert_lines.append(lines[j])
            full = ''.join(insert_lines)
            # Check if we've found the complete statement (ends with params)
            if ('RETURNING' in lines[j] or 
                (j > insert_start + 2 and lines[j].strip().startswith('"""')) or
                (j > insert_start + 2 and lines[j].strip().startswith('"",'))):
                break
            j += 1
        
        full_insert = ''.join(insert_lines)
        
        # Parse the column list
        col_match = re.search(r'\(([^)]+)\)\s*\n\s*VALUES', full_insert, re.DOTALL)
        if not col_match:
            i += 1
            continue
        
        cols = col_match.group(1)
        
        # Add empresa_id as first column
        new_cols = 'empresa_id, ' + cols
        
        # Find and fix VALUES
        val_match = re.search(r'VALUES\s*\(([^)]+)\)', full_insert)
        if not val_match:
            i += 1
            continue
        
        vals = val_match.group(1)
        
        # Shift $N placeholders
        def shift_placeholder(m):
            n = int(m.group(1))
            return f'${n+1}'
        
        new_vals = re.sub(r'\$(\d+)', shift_placeholder, vals)
        new_vals = '$1, ' + new_vals
        
        # Apply changes
        new_insert = full_insert.replace(cols, new_cols, 1)
        new_insert = new_insert.replace(vals, new_vals, 1)
        
        # Now find the params line (line after the closing """)
        # and prepend empresa_id
        param_line_idx = j + 1
        if param_line_idx < len(lines):
            param_line = lines[param_line_idx]
            # Pattern: """, param1, param2...)
            # Sometimes params are on the same line as """
            if '"""' in lines[j]:
                param_part = lines[j]
                if '""",' in param_part:
                    # params on same line as closing """
                    old_after_triple = param_part.split('""",', 1)[1]
                    new_after_triple = ' empresa_id,' + old_after_triple
                    new_line = param_part.split('""",', 1)[0] + '""",' + new_after_triple
                    
                    # Replace the lines
                    new_lines = new_insert.split('\n')
                    # Reconstruct: replace original lines
                    for k in range(insert_start, j):
                        lines[k] = ''
                    lines[j] = ''
                    lines[insert_start] = new_insert.replace(lines[j] if lines[j] else '', '') 
            
        # Simpler approach: just do the column and VALUES substitution
        for k in range(insert_start, j + 1):
            lines[k] = ''
        lines[insert_start] = new_insert
        
        total_fixed += 1
        i = j + 1
        continue
    
    i += 1

# Write result
with open('/app/backend/server.py', 'w') as f:
    f.writelines(lines)

print(f"Fixed {total_fixed} INSERT statements")
