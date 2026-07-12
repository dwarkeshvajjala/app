import { HomePage } from "./app/HomePage";
import { AppProviders } from "./app/providers";

// Full route tree (05-Frontend-Architecture.md §5.2) lands as each milestone's screens ship.
function App() {
  return (
    <AppProviders>
      <HomePage />
    </AppProviders>
  );
}

export default App;
