import { AppRouter } from "./app/router";
import { AppProviders } from "./app/providers";
import { ToastProvider } from "./components/Toast";

function App() {
  return (
    <AppProviders>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </AppProviders>
  );
}

export default App;
