import { useState, useEffect } from 'react';

const STORAGE_KEY = '8osk_contacts';

export function useContacts() {
    const [contacts, setContacts] = useState([]);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setContacts(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse contacts");
            }
        }
    }, []);

    const addContact = (name, id) => {
        // Prevent duplicates by ID
        const newContacts = [...contacts.filter(c => c.id !== id), { name, id }];
        setContacts(newContacts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
    };

    const removeContact = (id) => {
        const newContacts = contacts.filter(c => c.id !== id);
        setContacts(newContacts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
    };

    const editContact = (id, newName) => {
        const newContacts = contacts.map(c =>
            c.id === id ? { ...c, name: newName } : c
        );
        setContacts(newContacts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newContacts));
    };

    return { contacts, addContact, removeContact, editContact };
}
