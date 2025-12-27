import { AnalyticsProvider, useSchema, useQuery } from '@prismiq/react';
import { useState } from 'react';

function App() {
  return (
    <AnalyticsProvider baseUrl="http://localhost:8000">
      <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h1>Prismiq Basic Dashboard</h1>
        <SchemaExplorer />
        <QueryDemo />
      </div>
    </AnalyticsProvider>
  );
}

function SchemaExplorer() {
  const { data: schema, loading, error } = useSchema();

  if (loading) return <p>Loading schema...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!schema) return null;

  return (
    <section>
      <h2>Available Tables</h2>
      <ul>
        {schema.tables.map((table) => (
          <li key={`${table.schema}.${table.name}`}>
            <strong>{table.schema}.{table.name}</strong>
            <ul>
              {table.columns.map((col) => (
                <li key={col.name}>
                  {col.name} ({col.type})
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueryDemo() {
  const [tableName, setTableName] = useState('');
  
  const { data, loading, error, execute } = useQuery({
    tables: tableName ? [{ schema: 'public', table: tableName }] : [],
    columns: [{ table: tableName, column: '*' }],
    limit: 10,
  }, { manual: true });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tableName) execute();
  };

  return (
    <section>
      <h2>Query Demo</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder="Enter table name"
          style={{ padding: '0.5rem', marginRight: '0.5rem' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : 'Run Query'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}

      {data && (
        <table style={{ marginTop: '1rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {data.columns.map((col) => (
                <th key={col} style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                    {String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <p>
          Showing {data.rows.length} of {data.row_count} rows
          {data.truncated && ' (truncated)'}
        </p>
      )}
    </section>
  );
}

export default App;
