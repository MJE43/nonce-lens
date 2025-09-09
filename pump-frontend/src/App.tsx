import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import NewRun from "./pages/NewRun";
import RunDetail from "./pages/RunDetail";
import RunsList from "./pages/RunsList";
import Header from "./components/Header"; // Import the new Header

function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#333",
            color: "#fff",
          },
        }}
      />
      <div
        className="min-h-screen"
        style={{ backgroundColor: "var(--color-background)" }}
      >
        <Header /> {/* Add the Header component here */}
        <main>
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              <Route path="/" element={<RunsList />} />
              <Route path="/new" element={<NewRun />} />
              <Route path="/runs/:id" element={<RunDetail />} />
            </Routes>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;
