import type { Utilisateur } from '../model/Utilisateur';

export interface Session {
    token: string;
    utilisateur: Utilisateur;
}

const CLE_SESSION = 'steam-session';

export function lireSession(): Session | null {
    try {
        const valeur = sessionStorage.getItem(CLE_SESSION);
        return valeur ? JSON.parse(valeur) as Session : null;
    } catch {
        return null;
    }
}

export function enregistrerSession(session: Session): void {
    sessionStorage.setItem(CLE_SESSION, JSON.stringify(session));
}

export function fermerSession(): void {
    sessionStorage.removeItem(CLE_SESSION);
}

export function entetesAuthentifiees(): Record<string, string> {
    const session = lireSession();
    return session ? { Authorization: `Bearer ${session.token}` } : {};
}
