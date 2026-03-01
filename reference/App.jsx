import React, { useState, useEffect } from 'react'
import MainFrame from "./MainFrame.jsx";
import Login from "./Login.jsx";
import ComprehensiveApp from "./comprehensive-app.jsx";

// ============================================================
// CONFIGURATION
// ============================================================
const API_BASE_URL = 'https://c5lfwmzw33.execute-api.us-west-1.amazonaws.com/demo'
//const API_BASE_URL = 'http://localhost:5000'

export default function App() {
    const [theme,setTheme]=useState("dark");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user,setUser]=useState(null);
    const [buttons,setButtons]=useState([
        {id:"physicianCard",label:"Update Physician Card",url:"https://us.streamline.intellistack.app/start-session/ab292507-c16a-490f-af74-c31076957e91?source=url",isDefault:true,color:"#3b82f6",icon:"User"},
        {id:"requestLoan",label:"Request Loan Trays",url:"https://us.streamline.intellistack.app/start-session/7f22fb6c-a733-4a79-b96c-be42d9072bc8?source=url",isDefault:true,color:"#3b82f6",icon:"Truck"},
        {id:"confirmTrays",label:"Confirm Trays",url:"https://us.streamline.intellistack.app/start-session/7f18a193-3dc5-4c57-9d70-ef34aa1749a3?source=url",isDefault:true,color:"#3b82f6",icon:"CheckCircle2"},
        {id:"returnTrays",label:"Return Trays",url:"https://us.streamline.intellistack.app/start-session/398aaf4a-e360-466d-ad0a-b07b141afb52?source=url",isDefault:true,color:"#3b82f6",icon:"Truck"},
        {id:"custom1",label:"Custom 1",url:"#",isDefault:false,color:"#334155",icon:"Globe"},
    ]);
    const [users,setUsers]=useState([
        {username:'general@intellagentic.io',password:'Welcome1$',role:'general',name: 'Steve Blake',
            email: 'general@intellagentic.io',
            bio: 'Senior Management',
            avatar: 'SB',
            joinDate: 'January 2024',
            postsCount: 142,
            followersCount: 1247,
            followingCount: 389},
        {username:'scrub@intellagentic.io',password:'Welcome1$',role:'scrub',name: 'Lilian Blake',
            email: 'scrub@intellagentic.io',
            bio: 'Scrub Practitioner',
            avatar: 'LB',
            joinDate: 'January 2024',
            postsCount: 142,
            followersCount: 1247,
            followingCount: 389},
        {username:'matron@intellagentic.io',password:'Welcome1$',role:'matron',name: 'Galian Blake',
            email: 'matron@intellagentic.io',
            bio: 'Theatre Matron',
            avatar: 'GB',
            joinDate: 'January 2024',
            postsCount: 142,
            followersCount: 1247,
            followingCount: 389},
        {username:'hsdu@intellagentic.io',password:'Welcome1$',role:'hsdu',name: 'Trilian Blake',
            email: 'hsdu@intellagentic.io',
            bio: 'HSDU Manager',
            avatar: 'MB',
            joinDate: 'January 2024',
            postsCount: 142,
            followersCount: 1247,
            followingCount: 389}
    ]);

    useEffect(() => {
        document.body.style.cssText = `
      margin: 0;
      padding: 0;
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: ${theme === 'dark' ? '#0a0a0a' : 'rgb(241, 247, 247)'};
      transition: background 0.3s ease;
    `;
    }, [theme]);

    const handleTheme=async (t)=>{
        setTheme(t);
    }

    const setUserLogged = async(userProfile,isUserLogged)=>{
        setUser(userProfile);
        setIsLoggedIn(isUserLogged);
        if(!isUserLogged) {
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('username');
            sessionStorage.removeItem("theme");
            sessionStorage.removeItem("buttons");
            sessionStorage.removeItem("role");
        }
        else {
            sessionStorage.setItem("isLoggedIn",true);
            sessionStorage.setItem("username",userProfile.username);
            sessionStorage.setItem("theme","dark");
            sessionStorage.setItem("buttons",JSON.stringify(buttons));
        }
    }

    useEffect(() => {
        if(sessionStorage.getItem("isLoggedIn")===null) setIsLoggedIn(false);
        else {
            setTheme(sessionStorage.getItem("theme"));
            setIsLoggedIn(sessionStorage.getItem("isLoggedIn"));
            if(sessionStorage.getItem("buttons")) setButtons(JSON.parse(sessionStorage.getItem("buttons")));
            let susername = sessionStorage.getItem('username');
            let findUsers= users.filter((d)=>{return d.username === susername});
            if(findUsers.length>0) setUser(findUsers[0]);

        }

    }, [sessionStorage.getItem("isLoggedIn")])
    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div>
            {/* Header */}
            {isLoggedIn?<MainFrame setUserLogged={setUserLogged} userProfile={user} API_BASE_URL={API_BASE_URL} handleTheme={handleTheme} buttons={buttons} />: <Login setUserLogged={setUserLogged} users={users} API_BASE_URL={API_BASE_URL} />}
        </div>
    )
}