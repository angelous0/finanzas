"""
Fix SELECT * FROM finanzas2.cont_* WHERE id/xxx_id = $1 queries
to add AND empresa_id = $N for cross-company isolation.
"""
import re

GLOBAL_TABLES = ['cont_empresa', 'cont_moneda', 'cont_tipo_cambio']

with open('/app/backend/server.py', 'r') as f:
    lines = f.readlines()

fixed = 0

for i in range(len(lines)):
    line = lines[i]
    
    # Match SELECT patterns: "SELECT ... FROM finanzas2.cont_XXX WHERE field = $N"
    match = re.search(r'(SELECT [^"]*FROM finanzas2\.(cont_\w+)\s+WHERE\s+(\w+)\s*=\s*\$(\d+))"', line)
    if not match:
        continue
    
    full_select = match.group(1)
    table = match.group(2)
    field = match.group(3)
    param_num = int(match.group(4))
    
    # Skip global tables
    if table in GLOBAL_TABLES:
        continue
    
    # Skip if already has empresa_id
    if 'empresa_id' in line:
        continue
    
    # Skip child table queries by parent ID (oc_linea by oc_id, etc.)
    # These are less critical since parent is already filtered
    child_fields = ['oc_id', 'factura_id', 'gasto_id', 'pago_id', 'planilla_id', 
                    'presupuesto_id', 'conciliacion_id', 'venta_pos_id', 'tercero_id']
    if field in child_fields:
        continue
    
    # Add AND empresa_id = $N+1
    next_param = param_num + 1
    new_select = f'{full_select} AND empresa_id = ${next_param}"'
    old_pattern = f'{full_select}"'
    
    new_line = line.replace(old_pattern, new_select, 1)
    
    # Now add empresa_id to the params
    # Params are typically: ", value)" or ", value)\n"
    # Find the next line or same line with the closing params
    # Look for the pattern: $N", value)
    param_match = re.search(r'",\s*(.+?)(\))', line)
    if param_match:
        # Same line: add empresa_id before closing )
        old_end = param_match.group(0)
        new_end = old_end[:-1] + ', empresa_id)'
        new_line = new_line.replace(old_end, new_end, 1)
        lines[i] = new_line
        fixed += 1
    else:
        # Params might be on the next line
        lines[i] = new_line
        # Find the closing ) on a subsequent line
        for j in range(i+1, min(len(lines), i+5)):
            stripped = lines[j].rstrip()
            if stripped.endswith(')') and '"""' not in lines[j]:
                lines[j] = stripped[:-1] + ', empresa_id)\n'
                fixed += 1
                break
            elif '""",' in lines[j]:
                # Params on this line after """,
                old_param_line = lines[j]
                # Find closing )
                if old_param_line.rstrip().endswith(')'):
                    lines[j] = old_param_line.rstrip()[:-1] + ', empresa_id)\n'
                    fixed += 1
                break

with open('/app/backend/server.py', 'w') as f:
    f.writelines(lines)

print(f"Fixed {fixed} SELECT WHERE id queries")
