import React, { Component } from 'react'
import '../css/App.css'

import Login from './Login/Login'
import Home from './Home/Home' 

const AppScreen = {
  LOGIN: "LOGIN",
  HOME: "HOME"
}

class App extends Component {
  state = {
    currentScreen: AppScreen.LOGIN,
    user: null
  }

  loadUserInfo = (user) => {
    this.setState({
      currentScreen: AppScreen.HOME,
      user: user
    })
  }

  logout = () => {
    this.setState({
      currentScreen: AppScreen.LOGIN,
      user: null
    })
  }

  render() {
    switch(this.state.currentScreen) {
      case AppScreen.LOGIN:
        return <Login 
          loadUserInfo={this.loadUserInfo}
        />
      case AppScreen.HOME:
        return <Home 
          user={this.state.user}
          logout={this.logout}
        />
      default:
        return <div>ERROR</div>
    }
  }
}

export default App
