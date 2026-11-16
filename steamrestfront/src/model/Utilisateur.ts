export interface Utilisateur {
    utilisateurId: number;
    nomUtilisateur: string;
    email: string;
    dateInscription: string;
    role: 'utilisateur' | 'administrateur';
}
