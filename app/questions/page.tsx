import { createClient } from '@/utils/supabase/server';

export default async function Questions() {
  const supabase = await createClient();
  const { data: books } = await supabase.from('books').select();

  if (!books) {
    return <div>없음...</div>;
  }

  return (
    <div>
      <h1>Books</h1>
      <ul>
        {books.map((book) => (
          <li>{book.title}</li>
        ))}
      </ul>
    </div>
  );
}
