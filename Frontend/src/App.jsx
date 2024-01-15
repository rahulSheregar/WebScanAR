import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./components/Home/Home";
import Scan from "./components/Scan/Scan";
import Processing from "./components/Processing/Processing";
import Modelview from "./components/Modelview/Modelview";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/processing" element={<Processing />} />
        <Route path="/modelview" element={<Modelview />} />
      </Routes>
    </Router>
  );
}

export default App;
