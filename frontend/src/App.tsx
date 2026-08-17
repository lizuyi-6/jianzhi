import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import QuestionPage from './pages/QuestionPage';
import ReadingSetPage from './pages/ReadingSetPage';
import ReadPage from './pages/ReadPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<QuestionPage />} />
        <Route path="reading-set" element={<ReadingSetPage />} />
        <Route path="read/:role" element={<ReadPage />} />
      </Route>
    </Routes>
  );
}
