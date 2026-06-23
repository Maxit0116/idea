interface Props {
  title: string
  value: number
}

export default function StatsCard({ title, value }: Props) {
  return (
    <div style={{ padding: 16, border: '1px solid #eee', borderRadius: 8 }}>
      <h3>{title}</h3>
      <p style={{ fontSize: 24, fontWeight: 'bold' }}>{value.toLocaleString()}</p>
    </div>
  )
}
