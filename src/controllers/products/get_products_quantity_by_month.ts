import { Context } from 'hono/dist/types/context';
import { KardexService } from '../../services/products.service';
import { getDb } from '../../config/db';

export const getProductsQuantityByMonth = async (c: Context) => {
  const ref = c.req.query('ref')?.trim();
  if (ref && process.env.NODE_ENV === 'production' && process.env.ENABLE_DB_REF !== 'true') {
    return c.json({ success: false, error: 'Not Found' }, 404);
  }
  const db = getDb(ref);

  const itemId = c.req.query('item_id');
  if (!itemId) {
    return c.json({ success: false, error: 'item_id is required' }, 400);
  }

  const { rows } = await db.query(
    `
    SELECT 
      CASE 
        WHEN EXTRACT(MONTH FROM invoice_date) = 1 THEN 'Ene ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 2 THEN 'Feb ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 3 THEN 'Mar ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 4 THEN 'Abr ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 5 THEN 'May ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 6 THEN 'Jun ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 7 THEN 'Jul ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 8 THEN 'Ago ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 9 THEN 'Sep ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 10 THEN 'Oct ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 11 THEN 'Nov ' || EXTRACT(YEAR FROM invoice_date)
        WHEN EXTRACT(MONTH FROM invoice_date) = 12 THEN 'Dic ' || EXTRACT(YEAR FROM invoice_date)
      END as month,
      SUM(quantity) as quantity
    FROM kardex
    WHERE item_id = $1
      AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
      AND deleted_at IS NULL
    GROUP BY DATE_TRUNC('month', invoice_date), EXTRACT(MONTH FROM invoice_date), EXTRACT(YEAR FROM invoice_date)
    ORDER BY DATE_TRUNC('month', invoice_date) DESC
    `,
    [itemId]
  );

  return c.json({
    success: true,
    data: rows
  }, 200);
};