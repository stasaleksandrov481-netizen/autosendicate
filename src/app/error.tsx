'use client';
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{padding:24,color:'#fff',background:'#08080c',minHeight:'100vh'}}><h1>Ошибка клиента</h1><p>Интерфейс не смог завершить загрузку.</p><button onClick={reset}>Повторить</button></main>;
}
