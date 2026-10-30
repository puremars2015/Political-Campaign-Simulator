import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App.tsx';
import './ui/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('找不到 #root 節點');

class ErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    if (this.state.failed) return <main className="screen"><h1>遊戲資料暫時無法載入</h1><p role="alert">請重新整理後再試，若仍有問題請回報資料版本與操作。既有存檔不會自動清除。</p><button type="button" onClick={() => window.location.reload()}>重新載入</button></main>;
    return this.props.children;
  }
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
