const TEXT_BLOCK_TYPES = {
    REASONING_TEMPLATE: 'reasoning_template',
    LEGAL_BASIS: 'legal_basis',
    TOS_CLAUSE: 'tos_clause'
};

const DEFAULT_DSA_TEXT_BLOCKS = [
    {
        key: 'no_action',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Keine Maßnahme – kein hinreichender Verstoß',
        labelEn: 'No action – no sufficient violation found',
        descriptionDe: 'Nach Prüfung kein hinreichender Verstoß gegen Nutzungsbedingungen oder geltendes Recht.',
        descriptionEn: 'No sufficient violation of the Terms of Use or applicable law was found after review.',
        contentDe: `Nach Prüfung des gemeldeten öffentlichen Inhalts konnten wir keinen hinreichenden Verstoß gegen die Nutzungsbedingungen oder gegen geltendes Recht feststellen.
Auf Grundlage der derzeit vorliegenden Informationen bestand daher keine ausreichende Grundlage für eine Einschränkung oder Entfernung des Inhalts.
Das Verfahren wurde dokumentiert und ohne weitere Moderationsmaßnahme abgeschlossen.`,
        contentEn: `After reviewing the reported public content, we could not identify a sufficient violation of the Terms of Use or of applicable law.
Based on the information currently available, there was therefore no sufficient basis to restrict or remove the content.
The case was documented and closed without further moderation measures.`,
        sortOrder: 10,
        isActive: 1
    },
    {
        key: 'illegal_content_or_incitement',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Rechtswidrige Inhalte oder Aufruf zu Rechtsverstößen',
        labelEn: 'Illegal content or incitement to legal violations',
        descriptionDe: 'Abschnitt 10 – der Inhalt verstößt gegen geltendes Recht oder ruft zu Rechtsverstößen auf.',
        descriptionEn: 'Section 10 – the content violates applicable law or incites legal violations.',
        contentDe: `Nach Prüfung des gemeldeten öffentlichen Inhalts liegen hinreichende Anhaltspunkte dafür vor, dass der Inhalt gegen geltendes Recht verstößt oder zu Rechtsverstößen aufruft.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen unzulässig.
Der Inhalt wurde daher entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen. Die Entscheidung wurde dokumentiert; soweit gesetzlich vorgesehen, kann eine interne Beschwerde eingelegt werden.`,
        contentEn: `After reviewing the reported public content, there are sufficient indications that the content violates applicable law or incites legal violations.
Such content is not permitted under Section 10 of the Terms of Use.
The content was therefore restricted or removed from public visibility in line with the moderation measure taken. The decision was documented; where provided for by law, an internal complaint may be submitted.`,
        sortOrder: 20,
        isActive: 1
    },
    {
        key: 'public_personal_data',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Öffentliche Verbreitung persönlicher Informationen',
        labelEn: 'Public disclosure of personal information',
        descriptionDe: 'Abschnitt 9 und 10 – persönliche oder private Informationen dürfen nicht öffentlich zugänglich gemacht werden.',
        descriptionEn: 'Sections 9 and 10 – personal or private information must not be made publicly available.',
        contentDe: `Der gemeldete Inhalt macht persönliche oder private Informationen öffentlich zugänglich.
Nach Abschnitt 9 und Abschnitt 10 der Nutzungsbedingungen ist die öffentliche Veröffentlichung oder sonstige unbefugte Verbreitung personenbezogener Daten untersagt.
Zum Schutz der betroffenen Person und zur Einhaltung unserer Regeln wurde der Inhalt entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen.`,
        contentEn: `The reported content makes personal or private information publicly available.
Under Sections 9 and 10 of the Terms of Use, the public disclosure or other unauthorized distribution of personal data is prohibited.
To protect the affected person and to enforce our rules, the content was restricted or removed from public visibility in line with the moderation measure taken.`,
        sortOrder: 30,
        isActive: 1
    },
    {
        key: 'third_party_rights',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Verletzung von Rechten Dritter',
        labelEn: 'Infringement of third-party rights',
        descriptionDe: 'Abschnitt 10 – der Inhalt verletzt Rechte Dritter, etwa Persönlichkeits-, Urheber-, Marken- oder Datenschutzrechte.',
        descriptionEn: 'Section 10 – the content infringes third-party rights such as personal rights, copyrights, trademarks, or data protection rights.',
        contentDe: `Der gemeldete Inhalt verletzt nach unserer Prüfung Rechte Dritter, insbesondere Persönlichkeits-, Urheber-, Marken- oder Datenschutzrechte.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen unzulässig.
Zur Wahrung der Rechte betroffener Dritter wurde der Inhalt entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen.`,
        contentEn: `According to our review, the reported content infringes the rights of third parties, in particular personal rights, copyrights, trademark rights, or data protection rights.
Such content is not permitted under Section 10 of the Terms of Use.
To protect the rights of affected third parties, the content was restricted or removed from public visibility in line with the moderation measure taken.`,
        sortOrder: 40,
        isActive: 1
    },
    {
        key: 'harassment_hate_violence',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Belästigung, Hassrede oder Gewaltbezug',
        labelEn: 'Harassment, hate speech, or violent content',
        descriptionDe: 'Abschnitt 10 – Beleidigungen, Bedrohungen, Belästigung, Hassrede, Gewaltverherrlichung oder vergleichbare Inhalte.',
        descriptionEn: 'Section 10 – insults, threats, harassment, hate speech, glorification of violence, or similar content.',
        contentDe: `Der gemeldete Inhalt enthält nach unserer Prüfung Beleidigungen, Bedrohungen, gezielte Belästigung, Hassrede, Gewaltverherrlichung oder vergleichbare menschenverachtende Inhalte.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen verboten.
Zum Schutz anderer Nutzer und Dritter wurde der Inhalt entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen.`,
        contentEn: `According to our review, the reported content contains insults, threats, targeted harassment, hate speech, glorification of violence, or comparable inhuman content.
Such content is prohibited under Section 10 of the Terms of Use.
To protect other users and third parties, the content was restricted or removed from public visibility in line with the moderation measure taken.`,
        sortOrder: 50,
        isActive: 1
    },
    {
        key: 'sexual_or_youth_endangering_content',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Pornografische oder jugendgefährdende Inhalte',
        labelEn: 'Pornographic or youth-endangering content',
        descriptionDe: 'Abschnitt 10 – pornografische, sexuell explizite oder jugendgefährdende Inhalte.',
        descriptionEn: 'Section 10 – pornographic, sexually explicit, or youth-endangering content.',
        contentDe: `Der gemeldete Inhalt enthält nach unserer Prüfung pornografische, sexuell explizite oder jugendgefährdende Inhalte.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen verboten.
Zum Schutz insbesondere Minderjähriger und anderer Nutzer wurde der Inhalt entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen.`,
        contentEn: `According to our review, the reported content contains pornographic, sexually explicit, or youth-endangering material.
Such content is prohibited under Section 10 of the Terms of Use.
To protect users, especially minors, the content was restricted or removed from public visibility in line with the moderation measure taken.`,
        sortOrder: 60,
        isActive: 1
    },
    {
        key: 'sexual_content_involving_minors',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Sexuelle Inhalte mit Bezug zu Minderjährigen',
        labelEn: 'Sexual content involving minors',
        descriptionDe: 'Abschnitt 10 – Inhalte mit sexuellem Bezug zu Minderjährigen.',
        descriptionEn: 'Section 10 – content with sexual references to minors.',
        contentDe: `Der gemeldete Inhalt weist nach unserer Prüfung einen sexuellen Bezug zu Minderjährigen auf.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen in besonderem Maße verboten und können eine behördliche Relevanz begründen.
Der Inhalt wurde daher entsprechend der getroffenen Moderationsmaßnahme unverzüglich eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen; soweit erforderlich, werden weitere rechtliche Schritte geprüft.`,
        contentEn: `According to our review, the reported content contains sexual references to minors.
Such content is strictly prohibited under Section 10 of the Terms of Use and may also be relevant for reporting to authorities.
The content was therefore immediately restricted or removed from public visibility in line with the moderation measure taken; where necessary, further legal steps will be reviewed.`,
        sortOrder: 70,
        isActive: 1
    },
    {
        key: 'fraud_spam_or_impersonation',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Betrug, Spam oder Identitätstäuschung',
        labelEn: 'Fraud, spam, or impersonation',
        descriptionDe: 'Abschnitt 10 – irreführende, betrügerische, manipulative oder spamartige Inhalte.',
        descriptionEn: 'Section 10 – misleading, fraudulent, manipulative, or spam-like content.',
        contentDe: `Der gemeldete Inhalt ist nach unserer Prüfung irreführend, betrügerisch, manipulativ, spamartig oder täuscht eine falsche Identität beziehungsweise offizielle Vertretung vor.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen unzulässig.
Um Missbrauch des Dienstes zu verhindern und andere Nutzer zu schützen, wurde der Inhalt entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen.`,
        contentEn: `According to our review, the reported content is misleading, fraudulent, manipulative, spam-like, or falsely suggests another identity or official representation.
Such content is not permitted under Section 10 of the Terms of Use.
To prevent misuse of the service and protect other users, the content was restricted or removed from public visibility in line with the moderation measure taken.`,
        sortOrder: 80,
        isActive: 1
    },
    {
        key: 'security_abuse',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Sicherheitsmissbrauch oder Umgehung von Schutzmechanismen',
        labelEn: 'Security abuse or circumvention of protective measures',
        descriptionDe: 'Abschnitt 10 – Malware, Schadcode, Sicherheitsangriffe oder Umgehung von Schutzmechanismen.',
        descriptionEn: 'Section 10 – malware, malicious code, security attacks, or circumvention of protective measures.',
        contentDe: `Der gemeldete Inhalt steht nach unserer Prüfung im Zusammenhang mit Malware, Schadcode, Angriffen auf Sicherheit, Stabilität oder Verfügbarkeit des Dienstes oder mit der Anleitung zur Umgehung von Schutzmechanismen.
Solche Inhalte sind nach Abschnitt 10 der Nutzungsbedingungen verboten.
Zum Schutz des Dienstes und seiner Nutzer wurde der Inhalt entsprechend der getroffenen Moderationsmaßnahme eingeschränkt oder aus der öffentlichen Sichtbarkeit genommen.`,
        contentEn: `According to our review, the reported content is connected to malware, malicious code, attacks on the security, stability, or availability of the service, or to instructions for circumventing protective measures.
Such content is prohibited under Section 10 of the Terms of Use.
To protect the service and its users, the content was restricted or removed from public visibility in line with the moderation measure taken.`,
        sortOrder: 90,
        isActive: 1
    },
    {
        key: 'temporary_restriction_pending_review',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Vorläufige Einschränkung während weiterer Prüfung',
        labelEn: 'Temporary restriction pending further review',
        descriptionDe: 'Abschnitt 11.2 – vorsorgliche Einschränkung oder Ausblendung während der laufenden Prüfung.',
        descriptionEn: 'Section 11.2 – precautionary restriction or hiding during ongoing review.',
        contentDe: `Für den gemeldeten Inhalt bestehen Anhaltspunkte für eine mögliche Rechtswidrigkeit oder einen Verstoß gegen die Nutzungsbedingungen.
Bis zum Abschluss der weiteren Prüfung wurde die öffentliche Sichtbarkeit des Inhalts vorsorglich eingeschränkt.
Diese vorläufige Maßnahme erfolgt auf Grundlage von Abschnitt 11.2 der Nutzungsbedingungen. Nach Abschluss der weiteren Prüfung kann die Entscheidung bestätigt, angepasst oder aufgehoben werden.`,
        contentEn: `There are indications that the reported content may be illegal or may violate the Terms of Use.
Pending completion of the further review, the public visibility of the content has been restricted as a precaution.
This temporary measure is based on Section 11.2 of the Terms of Use. Once the further review is complete, the decision may be confirmed, changed, or lifted.`,
        sortOrder: 100,
        isActive: 1
    },
    {
        key: 'forwarded_to_competent_authority',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Weiterleitung an zuständige Behörde',
        labelEn: 'Forwarded to competent authority',
        descriptionDe: 'Abschnitt 11.2 – behördliche Weiterleitung bei möglicher Rechtsverletzung.',
        descriptionEn: 'Section 11.2 – referral to the competent authority in case of a possible legal violation.',
        contentDe: `Für den gemeldeten Inhalt bestehen nach unserer Prüfung hinreichende Anhaltspunkte für eine mögliche Rechtsverletzung mit behördlicher Relevanz.
Auf Grundlage von Abschnitt 11.2 der Nutzungsbedingungen wurde der Vorgang an die zuständige Behörde oder Stelle weitergeleitet.
Bis zur weiteren Klärung kann die öffentliche Sichtbarkeit des Inhalts eingeschränkt bleiben. Die Entscheidung und die zugrunde liegenden Informationen wurden dokumentiert.`,
        contentEn: `According to our review, there are sufficient indications that the reported content may involve a legal violation relevant to the competent authority.
Based on Section 11.2 of the Terms of Use, the case was forwarded to the competent authority or body.
Pending further clarification, the public visibility of the content may remain restricted. The decision and the underlying information have been documented.`,
        sortOrder: 110,
        isActive: 1
    },

    {
        key: 'no_sufficient_violation_found',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Kein hinreichender Verstoß gegen Nutzungsbedingungen oder geltendes Recht',
        labelEn: 'No sufficient violation of the Terms of Use or applicable law found',
        descriptionDe: 'Nach Prüfung fehlt eine ausreichende Grundlage für eine Einschränkung oder Entfernung.',
        descriptionEn: 'After review, there is no sufficient basis for restriction or removal.',
        contentDe: '',
        contentEn: '',
        sortOrder: 10,
        isActive: 1
    },
    {
        key: 'violation_section_10_illegal_content',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – rechtswidrige Inhalte oder Aufruf zu Rechtsverstößen',
        labelEn: 'Violation of Section 10 – illegal content or incitement to legal violations',
        descriptionDe: 'Der Inhalt verstößt gegen geltendes Recht oder ruft zu Rechtsverstößen auf.',
        descriptionEn: 'The content violates applicable law or incites legal violations.',
        contentDe: '',
        contentEn: '',
        sortOrder: 20,
        isActive: 1
    },
    {
        key: 'violation_section_10_third_party_rights',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – Rechte Dritter',
        labelEn: 'Violation of Section 10 – third-party rights',
        descriptionDe: 'Der Inhalt verletzt Rechte Dritter, etwa Persönlichkeits-, Urheber-, Marken- oder Datenschutzrechte.',
        descriptionEn: 'The content infringes the rights of third parties, such as personal rights, copyrights, trademarks, or data protection rights.',
        contentDe: '',
        contentEn: '',
        sortOrder: 30,
        isActive: 1
    },
    {
        key: 'violation_sections_9_10_personal_information',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 9 und 10 – öffentliche Verbreitung persönlicher Informationen',
        labelEn: 'Violation of Sections 9 and 10 – public disclosure of personal information',
        descriptionDe: 'Persönliche oder private Informationen wurden öffentlich zugänglich gemacht.',
        descriptionEn: 'Personal or private information was made publicly available.',
        contentDe: '',
        contentEn: '',
        sortOrder: 40,
        isActive: 1
    },
    {
        key: 'violation_section_10_harassment_hate_violence',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – Beleidigung, Bedrohung, Belästigung, Hassrede oder Gewalt',
        labelEn: 'Violation of Section 10 – insults, threats, harassment, hate speech, or violence',
        descriptionDe: 'Der Inhalt fällt in den Bereich Beleidigung, Bedrohung, Belästigung, Hassrede, Gewaltverherrlichung oder extremistischer Inhalte.',
        descriptionEn: 'The content falls within insults, threats, harassment, hate speech, glorification of violence, or extremist content.',
        contentDe: '',
        contentEn: '',
        sortOrder: 50,
        isActive: 1
    },
    {
        key: 'violation_section_10_sexual_or_youth_endangering',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – pornografische, sexuell explizite oder jugendgefährdende Inhalte',
        labelEn: 'Violation of Section 10 – pornographic, sexually explicit, or youth-endangering content',
        descriptionDe: 'Der Inhalt ist pornografisch, sexuell explizit oder jugendgefährdend.',
        descriptionEn: 'The content is pornographic, sexually explicit, or youth-endangering.',
        contentDe: '',
        contentEn: '',
        sortOrder: 60,
        isActive: 1
    },
    {
        key: 'violation_section_10_minor_related_sexual_content',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – sexuelle Inhalte mit Bezug zu Minderjährigen',
        labelEn: 'Violation of Section 10 – sexual content involving minors',
        descriptionDe: 'Der Inhalt weist einen sexuellen Bezug zu Minderjährigen auf.',
        descriptionEn: 'The content contains sexual references to minors.',
        contentDe: '',
        contentEn: '',
        sortOrder: 70,
        isActive: 1
    },
    {
        key: 'violation_section_10_fraud_spam_impersonation',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – Betrug, Spam oder Identitätstäuschung',
        labelEn: 'Violation of Section 10 – fraud, spam, or impersonation',
        descriptionDe: 'Der Inhalt ist irreführend, betrügerisch, manipulierend, spamartig oder täuscht eine falsche Identität vor.',
        descriptionEn: 'The content is misleading, fraudulent, manipulative, spam-like, or falsely suggests another identity.',
        contentDe: '',
        contentEn: '',
        sortOrder: 80,
        isActive: 1
    },
    {
        key: 'violation_section_10_security_abuse',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Verstoß gegen Abschnitt 10 – Malware, Sicherheitsangriffe oder Umgehung von Schutzmechanismen',
        labelEn: 'Violation of Section 10 – malware, security attacks, or circumvention of protective measures',
        descriptionDe: 'Der Inhalt betrifft Malware, Schadcode, Sicherheitsangriffe oder die Umgehung von Schutzmechanismen.',
        descriptionEn: 'The content relates to malware, malicious code, security attacks, or the circumvention of protective measures.',
        contentDe: '',
        contentEn: '',
        sortOrder: 90,
        isActive: 1
    },
    {
        key: 'temporary_restriction_section_11_2',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Vorläufige Einschränkung nach Abschnitt 11.2',
        labelEn: 'Temporary restriction under Section 11.2',
        descriptionDe: 'Vorsorgliche Einschränkung oder Ausblendung während einer laufenden Prüfung.',
        descriptionEn: 'Precautionary restriction or hiding during an ongoing review.',
        contentDe: '',
        contentEn: '',
        sortOrder: 100,
        isActive: 1
    },
    {
        key: 'forward_to_authority_section_11_2',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Weiterleitung an zuständige Behörde nach Abschnitt 11.2',
        labelEn: 'Referral to the competent authority under Section 11.2',
        descriptionDe: 'Weiterleitung an eine zuständige Behörde oder Stelle bei möglicher Rechtsverletzung.',
        descriptionEn: 'Referral to a competent authority or body in the event of a possible legal violation.',
        contentDe: '',
        contentEn: '',
        sortOrder: 110,
        isActive: 1
    },

    {
        key: 'section_9_public_personal_information',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 9 – Persönliche oder private Informationen dürfen nicht öffentlich zugänglich gemacht werden',
        labelEn: 'Section 9 – Personal or private information must not be made publicly available',
        descriptionDe: 'Abschnitt 9 verbietet die öffentliche Veröffentlichung persönlicher oder privater Informationen über sich selbst oder andere.',
        descriptionEn: 'Section 9 prohibits the public disclosure of personal or private information about oneself or others.',
        contentDe: '',
        contentEn: '',
        sortOrder: 10,
        isActive: 1
    },
    {
        key: 'section_10_illegal_content_or_incitement',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Inhalte oder Handlungen, die gegen geltendes Recht verstoßen oder zu Rechtsverstößen aufrufen',
        labelEn: 'Section 10 – Content or actions that violate applicable law or incite legal violations',
        descriptionDe: 'Verbot allgemeiner rechtswidriger Inhalte oder Aufrufe zu Rechtsverstößen.',
        descriptionEn: 'General prohibition of illegal content or incitement to legal violations.',
        contentDe: '',
        contentEn: '',
        sortOrder: 20,
        isActive: 1
    },
    {
        key: 'section_10_third_party_rights',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Inhalte, die Rechte Dritter verletzen',
        labelEn: 'Section 10 – Content that infringes the rights of third parties',
        descriptionDe: 'Betrifft insbesondere Persönlichkeits-, Urheber-, Marken- und Datenschutzrechte.',
        descriptionEn: 'In particular concerns personal rights, copyrights, trademarks, and data protection rights.',
        contentDe: '',
        contentEn: '',
        sortOrder: 30,
        isActive: 1
    },
    {
        key: 'section_10_criminal_content',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Strafbare Inhalte oder Aufrufe zu strafbaren Handlungen',
        labelEn: 'Section 10 – Criminal content or incitement to criminal acts',
        descriptionDe: 'Betrifft strafbare Inhalte oder Aufforderungen zu Straftaten.',
        descriptionEn: 'Concerns criminal content or calls to commit criminal acts.',
        contentDe: '',
        contentEn: '',
        sortOrder: 40,
        isActive: 1
    },
    {
        key: 'section_10_harassment',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Beleidigungen, Bedrohungen, gezielte Belästigung, Mobbing oder Stalking',
        labelEn: 'Section 10 – Insults, threats, targeted harassment, bullying, or stalking',
        descriptionDe: 'Schützt Nutzer und Dritte vor gezielten Übergriffen und Einschüchterung.',
        descriptionEn: 'Protects users and third parties from targeted abuse and intimidation.',
        contentDe: '',
        contentEn: '',
        sortOrder: 50,
        isActive: 1
    },
    {
        key: 'section_10_hate_violence_extremism',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Hassrede, Gewaltverherrlichung, extremistische oder menschenverachtende Inhalte',
        labelEn: 'Section 10 – Hate speech, glorification of violence, extremist, or inhuman content',
        descriptionDe: 'Verbot von Hassrede, Gewaltverherrlichung sowie extremistischer oder menschenverachtender Kommunikation.',
        descriptionEn: 'Prohibits hate speech, glorification of violence, and extremist or inhuman communication.',
        contentDe: '',
        contentEn: '',
        sortOrder: 60,
        isActive: 1
    },
    {
        key: 'section_10_pornographic_or_youth_endangering',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Pornografische, sexuell explizite oder jugendgefährdende Inhalte',
        labelEn: 'Section 10 – Pornographic, sexually explicit, or youth-endangering content',
        descriptionDe: 'Betrifft pornografische, sexuell explizite oder jugendgefährdende Inhalte.',
        descriptionEn: 'Concerns pornographic, sexually explicit, or youth-endangering content.',
        contentDe: '',
        contentEn: '',
        sortOrder: 70,
        isActive: 1
    },
    {
        key: 'section_10_minor_related_sexual_content',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Inhalte mit sexuellem Bezug zu Minderjährigen',
        labelEn: 'Section 10 – Content with sexual references to minors',
        descriptionDe: 'Betrifft Inhalte mit sexuellem Bezug zu Minderjährigen.',
        descriptionEn: 'Concerns content with sexual references to minors.',
        contentDe: '',
        contentEn: '',
        sortOrder: 80,
        isActive: 1
    },
    {
        key: 'section_10_public_disclosure_personal_information',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Öffentliche Veröffentlichung oder unbefugte Verbreitung persönlicher Informationen',
        labelEn: 'Section 10 – Public disclosure or unauthorized distribution of personal information',
        descriptionDe: 'Betrifft personenbezogene Daten wie Namen, Kontaktdaten, Standorte, Identitäts-, Finanz- oder Gesundheitsdaten.',
        descriptionEn: 'Concerns personal data such as names, contact details, locations, identity, financial, or health data.',
        contentDe: '',
        contentEn: '',
        sortOrder: 90,
        isActive: 1
    },
    {
        key: 'section_10_fraudulent_or_manipulative_content',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Irreführende, betrügerische oder manipulativ täuschende Inhalte',
        labelEn: 'Section 10 – Misleading, fraudulent, or manipulative content',
        descriptionDe: 'Betrifft täuschende oder betrügerische Inhalte.',
        descriptionEn: 'Concerns deceptive or fraudulent content.',
        contentDe: '',
        contentEn: '',
        sortOrder: 100,
        isActive: 1
    },
    {
        key: 'section_10_spam_or_abusive_automation',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Spam, Kettennachrichten, missbräuchliche Massenverbreitung oder schädliche Automatisierung',
        labelEn: 'Section 10 – Spam, chain messages, abusive mass distribution, or harmful automation',
        descriptionDe: 'Betrifft Spam, Kettennachrichten sowie missbräuchliche oder schädliche Automatisierung.',
        descriptionEn: 'Concerns spam, chain messages, and abusive or harmful automation.',
        contentDe: '',
        contentEn: '',
        sortOrder: 110,
        isActive: 1
    },
    {
        key: 'section_10_malware_or_circumvention',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Malware, Schadcode oder Anleitungen zur Umgehung von Sicherheitsmechanismen',
        labelEn: 'Section 10 – Malware, malicious code, or instructions for circumventing security mechanisms',
        descriptionDe: 'Betrifft Malware, Schadcode oder Hilfestellungen zur Umgehung von Sicherheitsmechanismen.',
        descriptionEn: 'Concerns malware, malicious code, or assistance in circumventing security mechanisms.',
        contentDe: '',
        contentEn: '',
        sortOrder: 120,
        isActive: 1
    },
    {
        key: 'section_10_attacks_on_service_security',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Angriffe auf Sicherheit, Stabilität oder Verfügbarkeit des Dienstes',
        labelEn: 'Section 10 – Attacks on the security, stability, or availability of the service',
        descriptionDe: 'Betrifft Angriffe auf den technischen Betrieb des Dienstes.',
        descriptionEn: 'Concerns attacks on the technical operation of the service.',
        contentDe: '',
        contentEn: '',
        sortOrder: 130,
        isActive: 1
    },
    {
        key: 'section_10_circumvention_of_usage_limits',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Umgehung von Nutzungsbegrenzungen',
        labelEn: 'Section 10 – Circumvention of usage restrictions',
        descriptionDe: 'Betrifft insbesondere die missbräuchliche Umgehung von Nutzungszeit-Schutz oder Eltern-PINs.',
        descriptionEn: 'In particular concerns the abusive circumvention of usage time protection or parental PINs.',
        contentDe: '',
        contentEn: '',
        sortOrder: 140,
        isActive: 1
    },
    {
        key: 'section_10_false_identity_or_representation',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 10 – Vortäuschung einer falschen Identität, Partnerschaft oder offiziellen Vertretung',
        labelEn: 'Section 10 – False identity, partnership, or official representation',
        descriptionDe: 'Betrifft Identitätstäuschung oder das Vorspiegeln offizieller Vertretung.',
        descriptionEn: 'Concerns impersonation or falsely suggesting official representation.',
        contentDe: '',
        contentEn: '',
        sortOrder: 150,
        isActive: 1
    },
    {
        key: 'section_11_2_temporary_restriction',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 11.2 – Zeitweise Einschränkung oder Ausblendung bei laufender Prüfung',
        labelEn: 'Section 11.2 – Temporary restriction or hiding during ongoing review',
        descriptionDe: 'Erlaubt eine vorsorgliche Einschränkung oder Ausblendung während der laufenden Prüfung.',
        descriptionEn: 'Allows precautionary restriction or hiding while a review is ongoing.',
        contentDe: '',
        contentEn: '',
        sortOrder: 160,
        isActive: 1
    },
    {
        key: 'section_11_2_forward_to_authorities',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Abschnitt 11.2 – Meldung an zuständige Behörden',
        labelEn: 'Section 11.2 – Reporting to competent authorities',
        descriptionDe: 'Erlaubt eine Meldung an zuständige Behörden, soweit rechtlich verpflichtet oder berechtigt.',
        descriptionEn: 'Allows reporting to competent authorities where legally required or permitted.',
        contentDe: '',
        contentEn: '',
        sortOrder: 170,
        isActive: 1
    }
];

module.exports = {
    TEXT_BLOCK_TYPES,
    DEFAULT_DSA_TEXT_BLOCKS
};
