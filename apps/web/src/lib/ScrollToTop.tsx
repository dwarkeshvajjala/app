import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Focus restoration for screen readers
    const focusContent = () => {
    const mainContent = document.querySelector<HTMLElement>('#workspace-content, main, .bl-project-route');
    if (mainContent && !document.querySelector('dialog[open]')) {
      mainContent.setAttribute('tabindex', '-1');
      mainContent.focus({ preventScroll: true });
      return true;
    }
    return false;
    };
    if (focusContent()) return;
    const observer = new MutationObserver(() => { if (focusContent()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
