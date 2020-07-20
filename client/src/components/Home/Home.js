import React, { Component } from 'react'
import TextField from '@material-ui/core/TextField'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress';
import Switch from '@material-ui/core/Switch';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import AddIcon from '@material-ui/icons/Add'
import DeleteIcon from '@material-ui/icons/Delete';

const api_url = "http://ec2-3-129-60-241.us-east-2.compute.amazonaws.com:8091";

class Home extends Component{

    constructor(props) {
        super(props);
        const { user_info, spamFilter, customCommands, timedCommands } = this.props.user;
        this.state = {
            updating: false,

            user: user_info.user,
            tempusId: user_info.tempusId,
            tempusOnly: user_info.tempusOnly,
            steamId: user_info.steamId,
            spam: spamFilter.spam,
            customCmds: Object.entries(customCommands.cmds),
            timedCmds: timedCommands.cmds
        };
    }

    /**
     * handler for clicking update button in navbar
     */
    handleUpdate = () => {
        this.setState({ updating: true });
        
        // trim off all entries that have empty values
        let customCommandsArr = this.state.customCmds.filter(entry => entry[0] !== "" && entry[1] !== "");
        let timedCommands = this.state.timedCmds.filter(entry => entry[0] > 5 && entry[0] !== NaN && entry[1] !== "");

        // turn customCommands into an object instead of an array
        let customCommands = {};
        customCommandsArr.forEach((cmd) => {
            customCommands[cmd[0]] = cmd[1];
        });

        // aggregate all data
        let data = {
            tempusId: this.state.tempusId,
            steamId: this.state.steamId,
            tempusOnly: this.state.tempusOnly,
            spam: this.state.spam,
            customCommands,
            timedCommands
        }

        // console.log(data);

        fetch(`${api_url}/updateuser/${this.state.user}`, {
            method: "POST",
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then((result) => {
            this.setState({ 
                updating: false,

                tempusId: result.user_info.tempusId,
                steamId: result.user_info.steamId,
                spam: result.spamFilter.spam,
                customCommands: result.customCommandsN.cmds,
                timedCommands: result.timedCommandsN.cmds
            });
        });
    }

    /**
     * general textfield change handler for tempusId and steamId
     */
    handleChange = (e) => {
        if(e.target.id === "tempus-id") {
            if(!isNaN(e.target.value)){
                this.setState({ tempusId: e.target.value });
            }
        } else if (e.target.id === "steam-id") {
            this.setState({ steamId: e.target.value });
        }
    }

    /**
     * change handler for spam
     */
    handleChangeSpam = (e) => {
        let newSpam = e.target.value.split(', ');
        this.setState({ spam: newSpam });
    }

    /**
     * change handler for custom commands input
     */
    handleChangeCustomInput = (index, event) => {
        let newCustomCmds = this.state.customCmds;
        newCustomCmds[index][0] = event.target.value;
        this.setState({ customCmds: newCustomCmds });
    }

    /**
     * change handler for custom commands output
     */
    handleChangeCustomOutput = (index, event) => {
        let newCustomCmds = this.state.customCmds;
        newCustomCmds[index][1] = event.target.value;
        this.setState({ customCmds: newCustomCmds });
    }

    /**
     * change handler for timed commands input
     */
    handleChangeTimedInput = (index, event) => {
        if (!isNaN(event.target.value)){
            if(event.target.value === "") {
                let newTimedCmds = this.state.timedCmds;
                newTimedCmds[index][0] = 0;
                this.setState({ timedCmds: newTimedCmds });
            } else {
                let newTimedCmds = this.state.timedCmds;
                newTimedCmds[index][0] = parseInt(event.target.value) * 60000;
                this.setState({ timedCmds: newTimedCmds });
            }
        }
    }

    /**
     * change handler for timed commands output
     */
    handleChangeTimedOutput = (index, event) => {
        let newTimedCmds = this.state.timedCmds;
        newTimedCmds[index][1] = event.target.value;
        this.setState({ timedCmds: newTimedCmds });
    }

    /**
     * delete handler for custom command item
     */
    handleDeleteCustom = (index) => {
        let newCustomCmds = this.state.customCmds;
        newCustomCmds.splice(index, 1);
        this.setState({ customCmds: newCustomCmds });
    }

    /**
     * delete handler for timed message item
     */
    handleDeleteTimed = (index) => {
        let newTimedCmds = this.state.timedCmds;
        newTimedCmds.splice(index, 1);
        this.setState({ timedCmds: newTimedCmds });
    }

    handleNewCustomItem = (index) => {
        let newCustomCmds = this.state.customCmds;
        newCustomCmds.splice(index, 0, ["", ""]);
        this.setState({ customCmds: newCustomCmds });
    }

    handleNewTimedItem = (index) => {
        let newTimedCmds = this.state.timedCmds;
        newTimedCmds.splice(index, 0, [0, ""]);
        this.setState({ timedCmds: newTimedCmds });
    }

    handleTempusOnly = (e) => {
        this.setState({ tempusOnly: !this.state.tempusOnly });
    }

    render() {
        let cmd_ctr = 0;
        let tmd_ctr = 0;
        return (
            <div>

                <div id="navbar">
                    <div id="navbar-logo">
                        fibubot
                        <span id="navbar-github-link"><img src="https://image.flaticon.com/icons/svg/25/25231.svg"
                            onClick={() => {require("electron").shell.openExternal('https://github.com/TaoLinShowdown/fibubot')}}></img></span>
                    </div>

                    <div id="navbar-buttons">
                        <Button id="navbar-button-update" variant="contained" onClick={this.handleUpdate} >
                            {this.state.updating && <CircularProgress size={20} />}
                            {!this.state.updating && "Update"}    
                        </Button>
                    </div>

                    <div id="navbar-user-name"><div id="name">{this.state.user}</div></div>
                </div>

                <div id="home">

                    <div id="tempusOnly-radio">
                        <FormControlLabel
                            value="tempusOnly"
                            control={<Switch color="primary" checked={this.state.tempusOnly} onChange={this.handleTempusOnly} />}
                            label="Tempus Only"
                            labelPlacement="start"
                            />
                    </div>

                    <div id="home-basic">
                        <div id="home-basic-id">
                            <TextField id="tempus-id" label="Tempus ID" variant="filled" value={this.state.tempusId} required onChange={this.handleChange} />
                            <TextField id="steam-id" label="Steam ID" variant="filled" value={this.state.steamId} required onChange={this.handleChange} />
                        </div>

                        <TextField id="spam-filter" label="Spam Filter" variant="filled" fullWidth multiline rows={4} defaultValue={this.state.spam.join(', ')}
                            onChange={this.handleChangeSpam} />
                    </div>

                    <div id="custom-commands" className="commands">
                        <span className="commands-title"> Custom Commands </span>

                        {this.state.customCmds && this.state.customCmds.map( (cmd) => (
                            <div className="commands-item" key={cmd_ctr++}>
                                <TextField className="commands-input" variant="filled" label="Command" value={cmd[0]} 
                                    onChange={this.handleChangeCustomInput.bind(event, cmd_ctr - 1)} />
                                <TextField className="commands-output" variant="filled" label="Output" value={cmd[1]} 
                                    onChange={this.handleChangeCustomOutput.bind(event, cmd_ctr - 1)}/>
                                <Button variant="outlined"
                                    onClick={this.handleDeleteCustom.bind(event, cmd_ctr - 1)} ><DeleteIcon/></Button>
                            </div>
                        ))}
                        
                        <Button className="commands-add-button" variant="contained"
                            onClick={this.handleNewCustomItem.bind(event, cmd_ctr)} ><AddIcon/></Button>
                    </div>

                    <div id="timed-commands" className="commands">
                        <span className="commands-title"> Timed Messages </span>

                        {this.state.timedCmds && this.state.timedCmds.map( (cmd) => (
                            <div className="commands-item" key={tmd_ctr++}>
                                <TextField className="commands-input" variant="filled" label="Time (min)" value={cmd[0]/60000}
                                    onChange={this.handleChangeTimedInput.bind(event, tmd_ctr - 1)} />
                                <TextField className="commands-output" variant="filled" label="Output" value={cmd[1]}
                                    onChange={this.handleChangeTimedOutput.bind(event, tmd_ctr - 1)} />
                                <Button variant="outlined" 
                                    onClick={this.handleDeleteTimed.bind(event, tmd_ctr - 1)} ><DeleteIcon/></Button>
                            </div>
                        ))}
                        
                        <Button className="commands-add-button" variant="contained"
                            onClick={this.handleNewTimedItem.bind(event, tmd_ctr)} ><AddIcon/></Button>
                    </div>
                </div>
            </div>
        )
    }
}

export default Home