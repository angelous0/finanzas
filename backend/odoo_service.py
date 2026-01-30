import xmlrpc.client
import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class OdooService:
    """Service for connecting to Odoo via XML-RPC"""
    
    def __init__(self, company: str = "ambission"):
        """Initialize Odoo connection for specified company"""
        self.company = company
        
        if company == "ambission":
            self.url = "https://ambission.app-gestion.net"
            self.db = "ambission"
            self.username = "admin_ambission@ambission.com"
            self.password = "ambission123"
        elif company == "proyectomoda":
            self.url = "https://ambission.app-gestion.net"
            self.db = "ambission"
            self.username = "proyectomoda@ambission.com"
            self.password = "proyectomoda123"
        else:
            raise ValueError(f"Unknown company: {company}")
        
        self.uid = None
        self.models = None
        self.common = None
    
    def authenticate(self) -> bool:
        """Authenticate with Odoo server"""
        try:
            logger.info(f"Authenticating with Odoo ({self.company}) at {self.url}")
            
            self.common = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common", allow_none=True)
            
            self.uid = self.common.authenticate(self.db, self.username, self.password, {})
            
            if not self.uid:
                logger.error(f"Odoo authentication failed for {self.company}")
                return False
            
            self.models = xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object", allow_none=True)
            
            logger.info(f"Successfully authenticated with Odoo (uid: {self.uid})")
            return True
            
        except Exception as e:
            logger.error(f"Odoo authentication error: {e}")
            return False
    
    def get_pos_orders(self, days_back: int = 30, limit: int = 500) -> List[Dict[str, Any]]:
        """
        Retrieve POS orders from Odoo
        
        Fields requested:
        - id, date_order, name, tipo_comp, num_comp
        - partner_id, x_tienda, vendedor_id, company_id
        - x_pagos, quantity_pos_order, amount_total, state
        - x_reserva_pendientes, x_reserva_facturada, is_cancel
        - order_cancel, reserva, is_credit, reserva_use_id
        """
        if not self.uid or not self.models:
            logger.error("Not authenticated with Odoo")
            return []
        
        try:
            cutoff_date = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d 00:00:00')
            
            domain = [
                ('date_order', '>=', cutoff_date),
            ]
            
            logger.info(f"Fetching POS orders from Odoo ({self.company}) from last {days_back} days")
            
            # Get all fields from pos.order
            orders = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                'pos.order',
                'search_read',
                [domain],
                {
                    'fields': [
                        'id',
                        'date_order',
                        'name',
                        'partner_id',
                        'amount_total',
                        'state',
                        'company_id',
                        'user_id',
                        'session_id',
                    ],
                    'limit': limit,
                    'order': 'date_order desc'
                }
            )
            
            # Try to get custom fields if available
            try:
                orders_extended = self.models.execute_kw(
                    self.db,
                    self.uid,
                    self.password,
                    'pos.order',
                    'search_read',
                    [domain],
                    {
                        'fields': [
                            'id',
                            'date_order',
                            'name',
                            'x_tipo_comp',
                            'x_num_comp',
                            'partner_id',
                            'x_tienda',
                            'x_vendedor_id',
                            'company_id',
                            'x_pagos',
                            'x_quantity_pos_order',
                            'amount_total',
                            'state',
                            'x_reserva_pendientes',
                            'x_reserva_facturada',
                            'x_is_cancel',
                            'x_order_cancel',
                            'x_reserva',
                            'x_is_credit',
                            'x_reserva_use_id',
                        ],
                        'limit': limit,
                        'order': 'date_order desc'
                    }
                )
                if orders_extended:
                    orders = orders_extended
            except Exception as e:
                logger.warning(f"Could not fetch extended fields: {e}")
            
            logger.info(f"Retrieved {len(orders)} POS orders from Odoo")
            return orders
            
        except Exception as e:
            logger.error(f"Error retrieving POS orders from Odoo: {e}")
            return []
    
    def get_order_details(self, order_id: int) -> Optional[Dict[str, Any]]:
        """Get detailed information about a specific POS order"""
        if not self.uid or not self.models:
            return None
        
        try:
            order = self.models.execute_kw(
                self.db,
                self.uid,
                self.password,
                'pos.order',
                'read',
                [[order_id]]
            )
            
            return order[0] if order else None
            
        except Exception as e:
            logger.error(f"Error retrieving order details: {e}")
            return None
