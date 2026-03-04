import { Context } from 'hono/dist/types/context';
import { getDb } from '../../config/db';

export const getTopCustomersByProduct = async (c: Context) => {
  const ref = c.req.query('ref')?.trim();
  if (ref && process.env.NODE_ENV === 'production' && process.env.ENABLE_DB_REF !== 'true') {
    return c.json({ success: false, error: 'Not Found' }, 404);
  }
  const db = getDb(ref);

  const itemId = c.req.query('item_id');
  if (!itemId) {
    return c.json({ success: false, error: 'item_id is required' }, 400);
  }

  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '10', 10);

  if (limit < 1 || limit > 1000) {
    return c.json({ success: false, error: 'Limit must be between 1 and 1000' }, 400);
  }

  // Primero obtenemos el total de clientes para la paginación
  const totalCustomersResult = await db.query(
    `
    SELECT COUNT(DISTINCT person_name) as total
    FROM kardex 
    WHERE item_id = $1 
      AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
      AND deleted_at IS NULL
      AND person_name IS NOT NULL
    `,
    [itemId]
  );

  const totalCustomers = parseInt(totalCustomersResult.rows[0]?.total || '0', 10);
  const totalPages = Math.ceil(totalCustomers / limit);
  const offset = (page - 1) * limit;

  // Obtenemos los clientes ordenados por cantidad total (mayor a menor)
  const customersResult = await db.query(
    `
    WITH customer_totals AS (
      SELECT 
        person_name,
        SUM(quantity) as total_quantity
      FROM kardex 
      WHERE item_id = $1 
        AND invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
        AND deleted_at IS NULL
        AND person_name IS NOT NULL
      GROUP BY person_name
      ORDER BY total_quantity DESC
      LIMIT $2 OFFSET $3
    )
    SELECT ct.person_name, ct.total_quantity
    FROM customer_totals ct
    ORDER BY ct.total_quantity DESC
    `,
    [itemId, limit, offset]
  );

  const customers = customersResult.rows;

  // Para cada cliente, obtenemos la distribución mensual
  const data: any[] = [];
  
  for (const customer of customers) {
    const monthlyResult = await db.query(
      `
      WITH months AS (
        SELECT 
          generate_series(
            DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months',
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
          )::date as month_start
      ),
      monthly_data AS (
        SELECT 
          m.month_start,
          CASE 
            WHEN EXTRACT(MONTH FROM m.month_start) = 1 THEN 'Ene ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 2 THEN 'Feb ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 3 THEN 'Mar ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 4 THEN 'Abr ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 5 THEN 'May ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 6 THEN 'Jun ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 7 THEN 'Jul ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 8 THEN 'Ago ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 9 THEN 'Sep ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 10 THEN 'Oct ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 11 THEN 'Nov ' || EXTRACT(YEAR FROM m.month_start)
            WHEN EXTRACT(MONTH FROM m.month_start) = 12 THEN 'Dic ' || EXTRACT(YEAR FROM m.month_start)
          END as month,
          COALESCE(SUM(k.quantity), 0) as quantity
        FROM months m
        LEFT JOIN kardex k ON DATE_TRUNC('month', k.invoice_date) = m.month_start
          AND k.item_id = $1
          AND k.person_name = $2
          AND k.invoice_date >= (CURRENT_DATE - INTERVAL '12 months')
          AND k.deleted_at IS NULL
        GROUP BY m.month_start, EXTRACT(MONTH FROM m.month_start), EXTRACT(YEAR FROM m.month_start)
        ORDER BY m.month_start DESC
      )
      SELECT month, quantity FROM monthly_data
      `,
      [itemId, customer.person_name]
    );

    const monthlyData: Record<string, string> = {};
    let totalQuantity = 0;

    for (const row of monthlyResult.rows) {
      monthlyData[row.month] = row.quantity.toString();
      totalQuantity += parseInt(row.quantity, 10);
    }

    data.push({
      client_name: customer.person_name,
      cantidad_total: customer.total_quantity.toString(),
      meses: monthlyData
    });
  }

  return c.json({
    success: true,
    data: data,
    data_items: totalCustomers,
    page_current: page,
    page_total: totalPages,
    have_next_page: page < totalPages,
    have_previus_page: page > 1
  }, 200);
};