import React, { useState, useEffect } from 'react';
import GroupList from './GroupList';
import EmailList from './EmailList';
import Form from './Form';

function App() {
    const [groups, setGroups] = useState([]);
    const [filteredEmails, setFilteredEmails] = useState([]);
    const [groupId, setGroupId] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(null);

    // Function to fetch groups
    const fetchGroups = async () => {
        try {
            const response = await fetch('/api/groups');
            if (response.ok) {
                const data = await response.json();
                setGroups(data);
            } else {
                console.error('Failed to load groups:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
        }
    };

    // Function to fetch filtered emails and group data by group ID
    const fetchFilteredEmailsAndGroup = async (groupId) => {
        try {
            const response = await fetch(`/api/groups/${groupId}/filtered-emails`);
            if (response.ok) {
                const data = await response.json();
                setSelectedGroup(data.group);
                setFilteredEmails(data.filteredEmails);
            } else {
                console.error('Failed to load group and filtered emails:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching group and filtered emails:', error);
        }
    };

    // Function to handle group creation
    const handleCreateGroup = (newGroup) => {
        setGroups((prevGroups) => [...prevGroups, newGroup]);
    };

    // Function to handle group selection
    const handleGroupSelection = (selectedGroupId) => {
        setGroupId(selectedGroupId);
        fetchFilteredEmailsAndGroup(selectedGroupId);
    };

    // Fetch groups when the component mounts
    useEffect(() => {
        fetchGroups();
    }, []);

    return (
        <div>
            <h1>Group and Email Dashboard</h1>
            <Form onCreateGroup={handleCreateGroup} />
            <GroupList groups={groups} onGroupSelect={handleGroupSelection} />
            {selectedGroup && <EmailList group={selectedGroup} emails={filteredEmails} />}
        </div>
    );
}

export default App;
