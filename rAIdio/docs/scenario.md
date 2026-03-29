# Scenario d'usage

## Objectif du document
- Fournir un scenario d'usage pour le systeme d'aide en cas de catastrophe naturelle.
- Decrie la demonstration de presentation du produit (V0) pour le systeme d'aide en cas de catastrophe naturelle.

## Contexte
Un utilisateur dispose du systeme d'aide en cas de catastrophe naturelle.
Le systeme d'aide peut se connecter a une radio pour ecouter les informations diffusées par les autorités et est capable de les analyser pour en extraire des informations utiles.
L'apparail n'a pas accées a internet.

## Onboarding

L'utilisateur va chercher l'appareil et l'allume.

Lorsque l'appareil s'allume, l'utilisateur est onboardé par le message suivant:

"""
Je suis votre assistant en cas de catastrophe. Pressez sur le bouton rouge pour avoir plus d'information.
L'appareil est connecté à toute les stations pour vous fournir les informations les plus récentes sur la situation.
"""


L'utilisateur fait un appui court sur le bouton

"""
Pour communiquer avec moi, faites un appui long sur le bouton rouge. Je vous fournirai des informations utiles pour vous aider à faire face à la situation.
"""

L'utilisateur fait un appui long sur le bouton

Il decrit la situation:
e.g. :
"Je suis dans une zone inondée, je suis bloqué dans ma maison et je ne sais pas quoi faire."
"Il n'y a plus d'electricite, je n'ai pas accès à internet et je ne peux pas contacter les secours."

L'appareil va onboardé l'utilisateur avec une serie de questions pour mieux comprendre la situation et lui fournir des informations utiles. (type de personne (enfant, adulte), situation d'urgence immediate, environnement immédiat, dangers, accès à l'eau potable, provisions de nourriture, etc.)

Appareil:
"""
J'écoute la totalité des stations de radio disponibles pour rassembler des informations sur la situation actuelle. En attendant, je souhaite vous poser quelques questions pour évaluer la situation. Pouvez me dire qui vous êtes.
"""

Utilisateur:
"""
Je suis un homme de 35 ans, je vis seul dans une maison en banlieue. Je n'ai pas de famille proche et je suis en bonne santé.
"""
ou encore
"""
Je m'appelle Marie, j'ai 28 ans et je suis chez moi
"""

Appareil:
"""Merci pour ces informations, pouvez vous me dire si vous etes en situation d'urgence ou si vous avez besoin d'aide immédiate?
"""

Utilisateur:
"""Je suis en situation d'urgence, je suis bloqué dans ma maison et je ne peux pas sortir
"""
ou encore
"""Tout va bien pour moi, mais je n'ai plus d'electricite et je n'ai pas accès à internet, je ne peux pas contacter les secours"""

Appareil:
"""Pouvez vous me decrire votre environnement immédiat? Y a t-il des dangers autour de vous? Avez vous accès à de l'eau potable? Avez vous des provisions de nourriture?"""


Utilisateur:"""Il y a de l'eau qui entre dans ma maison, je suis bloqué dans ma chambre, je n'ai pas accès à de l'eau potable et je n'ai pas de provisions de nourriture"""
ou encore"""Il n'y a pas de danger immédiat autour de moi, je suis dans ma maison, je n'ai pas accès à de l'eau potable et je n'ai pas de provisions de nourriture"""

Appareil:"""C'est bien noté. Pouvez-vous me dire ce que vous savez de la situation actuelle.""

Utilisateur:"""Je n'ai pas beaucoup d'informations, il n'y a personne qui me donnner des informations et j'entend des sirenes au loin."""

# Sortie d'onboarding
(l'appareil vient de rassembler des informations sur la situation de l'utilisateur et de la situation actuelle à partir des stations de radio, il est maintenant en mesure de fournir des informations utiles à l'utilisateur pour l'aider à faire face à la situation.
L'appareil resume à l'utilisateur ce qu'il a compris de la situation de l'utilisateur, puis de la situation actuelle à partir des stations de radio, et lui fournit des informations utiles pour l'aider à faire face à la situation.)

Appareil:"""Merci pour ces informations, voici ce que j'ai compris de votre situation: vous êtes un homme de 35 ans, vous vivez seul dans une maison en banlieue, vous êtes en bonne santé, vous êtes en situation d'urgence car vous êtes bloqué dans votre maison et vous n'avez pas accès à de l'eau potable ni à des provisions de nourriture. En ce qui concerne la situation actuelle, j'ai rassemblé des informations à partir des stations de radio et voici ce que j'ai compris: il y a une inondation dans votre région, les autorités ont émis une alerte rouge et recommandent aux habitants de rester chez eux et de se préparer à évacuer si nécessaire. Je vous recommande de rester calme, de rester à l'intérieur et de suivre les instructions des autorités. Si la situation devient critique, essayez de trouver un endroit sûr dans votre maison où vous pouvez attendre les secours.
"""

Appareil
"""
Avez-vous besoin d'autres informations ou d'aide pour faire face à la situation?
"""
(l'appareil continue à ecouter les stations de radio pour rassembler des informations sur la situation actuelle et à fournir des informations utiles à l'utilisateur pour l'aider à faire face à la situation.)


# Suite de la gestion de crise

L'appareil continue à ecouter les stations de radio pour rassembler des informations sur la situation actuelle et à fournir des informations utiles à l'utilisateur pour l'aider à faire face à la situation et repond au question de l'utilisateur.



## Demo de presentation du produit (V0)

L'appareil n'est pas encore en mesure de rassembler des informations à partir des stations de radio, mais il est capable de simuler cette fonctionnalité en utilisant des données pré-enregistrées. Des mock up des situations suivantes:

- Inondation
- Seisme
- Incendie de forêt
- Tempete de neige
- Explosition site SEVESO (e.g. AZF Toulouse)

Un des exemples de situation est choisie au hasard pour la demo, l'appareil doit simuler le rassemblent d'informations à partir des stations de radio et fournir des informations utiles à l'utilisateur pour l'aider à faire face à la situation. L'utilisateur peut poser des questions à l'appareil pour obtenir plus d'informations sur la situation et l'appareil doit être capable de répondre de manière pertinente en utilisant les données pré-enregistrées.
