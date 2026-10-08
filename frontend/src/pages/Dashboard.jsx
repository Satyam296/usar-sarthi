import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowUpRight, BookOpen, Check, FileText, FileUp, LoaderCircle,
  LogOut, Search, ShieldCheck, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage } from '../api.js';
import BrandMark from '../components/BrandMark.jsx';

const departments = ['Academic Affairs', 'Admissions', 'Campus Life', 'Finance', 'Library', 'Student Services', 'Facilities', 'Other'];
const categories = ['Notice', 'Policy', 'Academic calendar', 'Form or service', 'Guide', 'Other'];

function formatDate(value) {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('usar-sarthi-user') || '{}');
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentError, setDocumentError] = useState('');
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [matches, setMatches] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const indexedDocuments = useMemo(() => documents.filter((document) => document.status === 'indexed').length, [documents]);
  const indexedChunks = useMemo(() => documents.reduce((total, document) => total + (document.status === 'indexed' ? document.chunkCount : 0), 0), [documents]);

  async function loadDocuments() {
    setLoadingDocuments(true);
    setDocumentError('');
    try {
      const { data } = await api.get('/documents');
      setDocuments(data.documents);
    } catch (error) {
      setDocumentError(apiErrorMessage(error));
    } finally {
      setLoadingDocuments(false);
    }
  }

  useEffect(() => { loadDocuments(); }, []);

  async function handleUpload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) {
      setFormError('Choose a PDF or TXT file first.');
      return;
    }
    const formData = new FormData();
    formData.append('title', title);
    formData.append('department', department);
    formData.append('category', category);
    formData.append('file', file);
    setUploading(true);
    setFormError('');
    try {
      await api.post('/documents/upload', formData);
      setTitle('');
      setDepartment('');
      setCategory('');
      setFile(null);
      form.reset();
      await loadDocuments();
    } catch (error) {
      setFormError(apiErrorMessage(error));
      await loadDocuments();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(document) {
    if (!window.confirm(`Delete “${document.title}” and its indexed chunks?`)) return;
    setDeletingId(document._id);
    setDocumentError('');
    try {
      await api.delete(`/documents/${document._id}`);
      setDocuments((current) => current.filter((item) => item._id !== document._id));
    } catch (error) {
      setDocumentError(apiErrorMessage(error));
    } finally {
      setDeletingId('');
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError('');
    setMatches(null);
    try {
      const { data } = await api.post('/documents/retrieve', { query: query.trim(), topK: 3 });
      setMatches(data.matches || []);
    } catch (error) {
      setSearchError(apiErrorMessage(error));
    } finally {
      setSearching(false);
    }
  }

  function signOut() {
    localStorage.removeItem('usar-sarthi-token');
    localStorage.removeItem('usar-sarthi-user');
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard"><BrandMark size={34} /><span>USAR Sarthi<small>KNOWLEDGE CONSOLE</small></span></a>
        <div className="sidebar-label">WORKSPACE</div>
        <a className="nav-item active" href="#knowledge"><BookOpen size={17} /> Knowledge base <span className="nav-count">{documents.length}</span></a>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-dot" /><span><b>Admin workspace</b><small>Knowledge management</small></span><Activity size={16} /></div>
          <div className="profile-row"><span className="avatar">{(user.name || 'A').slice(0, 1).toUpperCase()}</span><span className="profile-copy"><b>{user.name || 'Administrator'}</b><small>Administrator</small></span><button className="icon-button signout-button" onClick={signOut} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button></div>
        </div>
      </aside>

      <main className="main-content" id="knowledge">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <b>Knowledge base</b></div><div className="topbar-right"><span className="secure-label"><ShieldCheck size={15} /> Admin session</span><button className="mobile-signout" onClick={signOut} aria-label="Sign out"><LogOut size={17} /></button></div></header>
        <div className="page-wrap">
          <section className="page-heading"><div><span className="eyebrow">USAR KNOWLEDGE · 01</span><h1>Knowledge base</h1><p>Curate the documents behind reliable, USAR-grounded answers.</p></div><div className="heading-mark"><BookOpen size={23} /><span>INDEX<br />MANAGEMENT</span></div></section>

          <section className="metric-strip" aria-label="Knowledge base summary">
            <div className="metric"><span className="metric-icon"><FileText size={18} /></span><span className="metric-label">Documents</span><strong>{documents.length.toString().padStart(2, '0')}</strong><small>in the library</small></div>
            <div className="metric"><span className="metric-icon green"><Check size={18} /></span><span className="metric-label">Indexed</span><strong>{indexedDocuments.toString().padStart(2, '0')}</strong><small>ready to retrieve</small></div>
            <div className="metric"><span className="metric-icon coral"><Activity size={18} /></span><span className="metric-label">Text chunks</span><strong>{indexedChunks.toLocaleString()}</strong><small>searchable passages</small></div>
            <div className="metric metric-note"><span className="metric-note-number">01<span> / 03</span></span><div><b>Foundation phase</b><small>Admin knowledge operations</small></div><ArrowUpRight size={18} /></div>
          </section>

          <div className="workspace-grid">
            <section className="panel upload-panel">
              <div className="panel-heading"><div><span className="section-index">A / ADD TO LIBRARY</span><h2>Upload a document</h2></div><span className="panel-icon"><FileUp size={19} /></span></div>
              <form className="upload-form" onSubmit={handleUpload}>
                <label htmlFor="doc-title">Document title</label>
                <input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Academic calendar 2026–27" maxLength="200" required />
                <div className="field-row">
                  <div><label htmlFor="department">Department</label><select id="department" value={department} onChange={(event) => setDepartment(event.target.value)} required><option value="" disabled>Select department</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></div>
                  <div><label htmlFor="category">Category</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)} required><option value="" disabled>Select category</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
                </div>
                <label className="file-drop" htmlFor="document-file">
                  <span className="file-drop-icon"><FileUp size={20} /></span>
                  <span className="file-drop-copy"><b>{file ? file.name : 'Choose a file to upload'}</b><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ${file.name.split('.').pop().toUpperCase()}` : 'PDF or TXT · maximum 20 MB'}</small></span>
                  <span className="browse-button">Browse</span>
                  <input id="document-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                </label>
                {formError && <p className="form-error" role="alert">{formError}</p>}
                <button className="primary-button upload-submit" type="submit" disabled={uploading}>{uploading ? <><LoaderCircle className="spin" size={17} /> Indexing document…</> : <><FileUp size={17} /> Add to knowledge base</>}</button>
              </form>
              <div className="upload-footnote"><ShieldCheck size={15} /> Text is extracted and indexed for source retrieval.</div>
            </section>

            <section className="panel retrieval-panel">
              <div className="panel-heading"><div><span className="section-index">B / QUALITY CHECK</span><h2>Test retrieval</h2></div><span className="retrieval-tag"><span /> LIVE INDEX</span></div>
              <p className="panel-description">Try a campus question to inspect the passages the index finds.</p>
              <form className="search-form" onSubmit={handleSearch}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. When does course registration open?" aria-label="Search indexed documents" /><button type="submit" disabled={searching || !query.trim()} aria-label="Search" title="Search">{searching ? <LoaderCircle className="spin" size={18} /> : <ArrowUpRight size={19} />}</button></form>
              {searchError && <p className="form-error" role="alert">{searchError}</p>}
              {matches === null && !searching && <div className="retrieval-empty"><span className="empty-orbit"><Search size={20} /></span><span>Retrieved passages will appear here.</span></div>}
              {searching && <div className="retrieval-empty"><LoaderCircle className="spin" size={20} /><span>Searching indexed passages…</span></div>}
              {matches?.length === 0 && <div className="retrieval-empty"><span>No matching passages found.</span></div>}
              {matches?.length > 0 && <div className="match-list">{matches.map((match, index) => <article className="match-item" key={`${match.source}-${index}`}><div className="match-top"><span className="match-number">0{index + 1}</span><span className="match-source"><FileText size={14} />{match.source}{match.pageNumber ? ` · p. ${match.pageNumber}` : ''}</span><span className="match-score">{(match.score * 100).toFixed(0)}%</span></div><p>{match.chunkText}</p></article>)}</div>}
              <div className="retrieval-footnote">TOP 3 PASSAGES <span>·</span> COSINE SIMILARITY</div>
            </section>
          </div>

          <section className="panel documents-panel">
            <div className="panel-heading documents-heading"><div><span className="section-index">C / LIBRARY INVENTORY</span><h2>Documents <span className="heading-count">{documents.length}</span></h2></div><button className="text-button" onClick={loadDocuments} disabled={loadingDocuments}>{loadingDocuments ? <LoaderCircle className="spin" size={15} /> : 'Refresh'} {!loadingDocuments && <ArrowUpRight size={15} />}</button></div>
            {documentError && <p className="form-error table-error" role="alert">{documentError}</p>}
            <div className="table-scroll"><table><thead><tr><th>Title</th><th>Department</th><th>Status</th><th>Chunks</th><th>Upload date</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
              {loadingDocuments && <tr><td colSpan="6" className="table-state"><LoaderCircle className="spin" size={19} /> Loading library…</td></tr>}
              {!loadingDocuments && documents.length === 0 && <tr><td colSpan="6" className="table-state">Your document library is empty. Add the first campus resource above.</td></tr>}
              {!loadingDocuments && documents.map((document) => <tr key={document._id}><td><span className="document-title"><span className="document-file-icon"><FileText size={16} /></span><span>{document.title}<small>{document.category}</small></span></span></td><td>{document.department}</td><td><span className={`status-badge ${document.status}`}><i />{document.status}</span></td><td className="chunk-cell">{document.chunkCount || '—'}</td><td className="date-cell">{formatDate(document.uploadDate)}</td><td className="action-cell"><button className="icon-button delete-button" onClick={() => handleDelete(document)} disabled={deletingId === document._id} title="Delete document" aria-label={`Delete ${document.title}`}>{deletingId === document._id ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}</button></td></tr>)}
            </tbody></table></div>
            <div className="table-footer"><span><span className="status-dot" /> Admin session active</span><span>{documents.length} {documents.length === 1 ? 'document' : 'documents'}</span></div>
          </section>
          <footer className="page-footer"><span>USAR SARTHI <span>·</span> MONTH 01</span><span>ADMIN KNOWLEDGE MANAGEMENT</span></footer>
        </div>
      </main>
    </div>
  );
}