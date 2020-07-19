import React, { Component } from 'react'
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
// import shell from 'electron';

const api_url = "http://ec2-3-129-7-4.us-east-2.compute.amazonaws.com:8091"

class Login extends Component{

    state = {
        inputtedChannelName: "fibbbby"
    }

    handleChange = (e) => {
        this.setState({
            inputtedChannelName: e.target.value,
            waiting: false,
            error: false,
            errorMsg: ""
        })
    }

    handleSubmit = () => {
        // try to find the inputtedChannelName in mongodb
        
        let { inputtedChannelName } = this.state
        this.setState({waiting: true});
        fetch(`${api_url}/users/${inputtedChannelName}`)
            .then(res => res.json())
            .then((result) => {
                if (result.user_info === null) {
                    this.setState({error: true, errorMsg: "Couldn't find your channel name, make sure to first !join through twitch.tv/fibubot"})
                } else {
                    this.props.loadUserInfo(result)
                }
            },
            (error) => {
                this.setState({waiting: false, error: true, errorMsg: "Server's seem to be down, contact me for more info"})
                console.error(error)
            })
    }

    render() {
        return (
            <div id="login">
                <div id="login-logo">fibubot</div>

                <TextField id="channel-name-input" label="Channel Name" variant="outlined" autoFocus={true} onChange={this.handleChange} /><br/>
                <Button id="channel-name-submit" variant="contained" color="primary" onClick={this.handleSubmit} size="large" >Login</Button>

                {this.state.error && <div id="login-error">{this.state.errorMsg}</div>}
                {this.state.waiting && <div id="login-error">Loading...</div>}

                <div id="login-github-link">
                    <a onClick={() => {require("electron").shell.openExternal('https://github.com/TaoLinShowdown/fibubot')}}>
                        <img src="https://image.flaticon.com/icons/svg/25/25231.svg"></img>
                    </a>
                </div>
            </div>
        )
    }
}

export default Login