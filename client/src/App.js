import React from "reactn";
import { setGlobal } from 'reactn';
import Home from "./pages/Home";
import { hot } from "react-hot-loader";

setGlobal({
    channelName: '',
    steamId: '',
    tempusId: ''
});

function App() {
    return (
        <Home/>
    );
}

export default hot(module)(App); 
