import pg from 'pg';

const { Pool, types } = pg;

// 함정 §4-1: pg는 DATE(OID 1082)를 JS Date로 파싱 → 마감일 표시 깨짐.
// 'YYYY-MM-DD' 문자열을 원본 그대로 반환하도록 파서 교체.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  host: process.env.PGHOST || 'db',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.POSTGRES_USER || 'radar',
  password: process.env.POSTGRES_PASSWORD || 'radar',
  database: process.env.POSTGRES_DB || 'radar',
  max: 10,
});

export function query(text, params) {
  return pool.query(text, params);
}

export async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}

export default pool;
