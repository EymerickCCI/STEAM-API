import type { Jeu } from "./Jeu";

export interface BibliothequeJeux {
    bibliothequeId: number;
    utilisateurId: number;
    jeuId: number;
    jeu: Jeu;
    heuresJeu: number;
    estInstalle: boolean;
}
