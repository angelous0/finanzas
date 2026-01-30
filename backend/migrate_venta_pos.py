#!/usr/bin/env python3
"""
Migration script to add missing columns to cont_venta_pos table
"""
import asyncio
from database import get_pool
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def migrate():
    pool = await get_pool()
    
    async with pool.acquire() as conn:
        await conn.execute("SET search_path TO finanzas2, public")
        
        migrations = [
            # Add tienda columns
            ("tienda_id", "ALTER TABLE finanzas2.cont_venta_pos ADD COLUMN IF NOT EXISTS tienda_id INTEGER"),
            ("tienda_name", "ALTER TABLE finanzas2.cont_venta_pos ADD COLUMN IF NOT EXISTS tienda_name VARCHAR(200)"),
            
            # Add quantity_total (rename from quantity_pos_order)
            ("quantity_total", "ALTER TABLE finanzas2.cont_venta_pos ADD COLUMN IF NOT EXISTS quantity_total DECIMAL(12, 4)"),
            
            # Add reserva amount columns (rename from boolean to decimal)
            ("reserva_pendiente", "ALTER TABLE finanzas2.cont_venta_pos ADD COLUMN IF NOT EXISTS reserva_pendiente DECIMAL(15, 2) DEFAULT 0"),
            ("reserva_facturada", "ALTER TABLE finanzas2.cont_venta_pos ADD COLUMN IF NOT EXISTS reserva_facturada DECIMAL(15, 2) DEFAULT 0"),
        ]
        
        for col_name, sql in migrations:
            try:
                await conn.execute(sql)
                logger.info(f"✓ Added/verified column: {col_name}")
            except Exception as e:
                logger.error(f"✗ Error with column {col_name}: {e}")
        
        # Copy data from old columns if they exist
        try:
            # Check if old column exists
            old_col_exists = await conn.fetchval("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'finanzas2' 
                  AND table_name = 'cont_venta_pos' 
                  AND column_name = 'quantity_pos_order'
            """)
            
            if old_col_exists:
                await conn.execute("""
                    UPDATE finanzas2.cont_venta_pos 
                    SET quantity_total = quantity_pos_order 
                    WHERE quantity_total IS NULL AND quantity_pos_order IS NOT NULL
                """)
                logger.info("✓ Copied data from quantity_pos_order to quantity_total")
        except Exception as e:
            logger.warning(f"Could not copy old data: {e}")
        
        logger.info("\n✅ Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate())
