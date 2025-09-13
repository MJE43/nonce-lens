import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { MantineProvider, MantineThemeOverride } from "@mantine/core";
import NewRun from "./pages/NewRun";
import RunDetail from "./pages/RunDetail";
import RunsList from "./pages/RunsList";
import Header from "./components/Header"; // Import the new Header
import LiveStreamDetail from "./pages/LiveStreamDetail";
import LiveStreamsList from "./pages/LiveStreamsList";
import ErrorBoundary from "./components/ErrorBoundary";
import LiveStreamsErrorBoundary from "./components/LiveStreamsErrorBoundary";

// Import custom Mantine table styles
import "./styles/mantine-table.css";

// Dark theme configuration to match the existing design
const theme: MantineThemeOverride = {
  colorScheme: "dark",
  colors: {
    dark: [
      "#C1C2C5",
      "#A6A7AB",
      "#909296",
      "#5c5f66",
      "#373A40",
      "#2C2E33",
      "#25262b",
      "#1A1B1E",
      "#141517",
      "#101113",
    ],
  },
  components: {
    Table: {
      styles: {
        root: {
          backgroundColor: "hsl(222.2 84% 4.9%)", // --card
          border: "1px solid hsl(217.2 32.6% 17.5%)", // --border
          borderRadius: "0.5rem",
        },
        thead: {
          backgroundColor: "hsl(210 40% 8%)", // --muted
        },
        th: {
          color: "hsl(215.4 16.3% 46.9%)", // --muted-foreground
          fontWeight: 500,
          fontSize: "0.875rem",
          padding: "0.75rem",
          borderBottom: "1px solid hsl(217.2 32.6% 17.5%)",
        },
        td: {
          color: "hsl(210 40% 98%)", // --foreground
          padding: "0.75rem",
          borderBottom: "1px solid hsl(217.2 32.6% 17.5%)",
        },
        tbody: {
          tr: {
            "&:hover": {
              backgroundColor: "hsl(210 40% 8% / 0.5)",
            },
          },
        },
      },
    },
    Paper: {
      styles: {
        root: {
          backgroundColor: "hsl(222.2 84% 4.9%)",
          border: "1px solid hsl(217.2 32.6% 17.5%)",
        },
      },
    },
  },
};

function App() {
  return (
    <MantineProvider theme={theme}>
      <ErrorBoundary>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#333",
              color: "#fff",
            },
          }}
        />
        <div className="min-h-screen">
          <Header /> {/* Add the Header component here */}
          <main>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <Routes>
                <Route path="/" element={<RunsList />} />
                <Route path="/new" element={<NewRun />} />
                <Route path="/runs/:id" element={<RunDetail />} />
                <Route
                  path="/live"
                  element={
                    <LiveStreamsErrorBoundary>
                      <LiveStreamsList />
                    </LiveStreamsErrorBoundary>
                  }
                />
                <Route
                  path="/live/:id"
                  element={
                    <LiveStreamsErrorBoundary>
                      <LiveStreamDetail />
                    </LiveStreamsErrorBoundary>
                  }
                />
              </Routes>
            </div>
          </main>
        </div>
      </ErrorBoundary>
    </MantineProvider>
  );
}

export default App;
