import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import QuestionPage from './pages/QuestionPage';
import ReadingSetPage from './pages/ReadingSetPage';
import ReadPage from './pages/ReadPage';
import SearchPage from './pages/SearchPage';
import SourcePage from './pages/SourcePage';
import { CollectionsPage, FollowsPage, HistoryPage } from './pages/ListsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<QuestionPage />} />
        <Route path="reading-set" element={<ReadingSetPage />} />
        <Route path="read/:role" element={<ReadPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="source/:sourceId" element={<SourcePage />} />
        <Route path="follows" element={<FollowsPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>
    </Routes>
  );
}
