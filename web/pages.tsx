import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';
import {installPeerRoomApi} from './peer-room-client';
installPeerRoomApi();
createRoot(document.getElementById('root')!).render(<Home/>);
