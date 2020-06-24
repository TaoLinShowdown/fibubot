import React, { useGlobal } from 'reactn';

export default function BasicInformation() {

    const [ channelName, setChannelName ] = useGlobal("channelName");
    const [ steamId, setSteamId ] = useGlobal("steamId");
    const [ tempusId, setTempusId ] = useGlobal("tempusId");

    return (
        <div>
            <input type="text" placeholder="Twitch Channel Name" value={channelName} onChange={(e) => setChannelName(e.target.value)} />
            <input type="text" placeholder="Steam ID" value={steamId} onChange={(e) => setSteamId(e.target.value)} />
            <input type="text" placeholder="Tempus ID" value={tempusId} onChange={(e) => setTempusId(e.target.value)} />
        </div>
    );
}