const TEXT_BLOCK_TYPES = {
    REASONING_TEMPLATE: 'reasoning_template',
    LEGAL_BASIS: 'legal_basis',
    TOS_CLAUSE: 'tos_clause'
};

const DEFAULT_DSA_TEXT_BLOCKS = [
    {
        key: 'no_action',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'No action',
        labelEn: 'No action',
        descriptionDe: 'No violation found',
        descriptionEn: 'No violation found',
        contentDe: `Following a detailed review, the content does not appear to violate applicable law or the Terms of Use.
It remains visible to the public, as it falls within the boundaries of acceptable expression.
No enforcement measures were applied. The case is documented and closed.`,
        contentEn: `Following a detailed review, the content does not appear to violate applicable law or the Terms of Use.
It remains visible to the public, as it falls within the boundaries of acceptable expression.
No enforcement measures were applied. The case is documented and closed.`,
        sortOrder: 10,
        isActive: 1
    },
    {
        key: 'sensitive_context',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Sensitive context',
        labelEn: 'Sensitive context',
        descriptionDe: 'Sensitive context → restrict access',
        descriptionEn: 'Sensitive context → restrict access',
        contentDe: `This content presents a sensitive or potentially harmful context that may not be suitable for all audiences.
To minimize potential impact while preserving informational value, visibility has been restricted (e.g. age-gated or warning gate).
The user has been informed of this restriction and may appeal if they believe it was applied in error.`,
        contentEn: `This content presents a sensitive or potentially harmful context that may not be suitable for all audiences.
To minimize potential impact while preserving informational value, visibility has been restricted (e.g. age-gated or warning gate).
The user has been informed of this restriction and may appeal if they believe it was applied in error.`,
        sortOrder: 20,
        isActive: 1
    },
    {
        key: 'terms_of_use_violation',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Terms of Use violation',
        labelEn: 'Terms of Use violation',
        descriptionDe: 'Clear violation → restrict visibility',
        descriptionEn: 'Clear violation → restrict visibility',
        contentDe: `After careful assessment, this content was found to violate the Terms of Use, in particular Section 9 (Prohibited Use).
To protect users and comply with our rules, the content is no longer publicly visible and its visibility has been restricted.
The content remains stored for documentation and appeal review.
The decision was reviewed manually and logged for transparency purposes.`,
        contentEn: `After careful assessment, this content was found to violate the Terms of Use, in particular Section 9 (Prohibited Use).
To protect users and comply with our rules, the content is no longer publicly visible and its visibility has been restricted.
The content remains stored for documentation and appeal review.
The decision was reviewed manually and logged for transparency purposes.`,
        sortOrder: 30,
        isActive: 1
    },
    {
        key: 'forwarded_to_competent_authority',
        type: TEXT_BLOCK_TYPES.REASONING_TEMPLATE,
        labelDe: 'Forwarded to competent authority',
        labelEn: 'Forwarded to competent authority',
        descriptionDe: 'Potential legal relevance',
        descriptionEn: 'Potential legal relevance',
        contentDe: `During review, indicators suggested that this content may be relevant under applicable law.
To ensure due process and comply with legal obligations, the case has been forwarded to the competent public authority.
The content may remain restricted pending further evaluation.`,
        contentEn: `During review, indicators suggested that this content may be relevant under applicable law.
To ensure due process and comply with legal obligations, the case has been forwarded to the competent public authority.
The content may remain restricted pending further evaluation.`,
        sortOrder: 40,
        isActive: 1
    },
    {
        key: 'tos_violation_section_9',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Terms of Use violation (Section 9)',
        labelEn: 'Terms of Use violation (Section 9)',
        descriptionDe: 'Violates the prohibited use rules in the Terms of Use.',
        descriptionEn: 'Violates the prohibited use rules in the Terms of Use.',
        contentDe: '',
        contentEn: '',
        sortOrder: 10,
        isActive: 1
    },
    {
        key: 'unlawful_content_section_9',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Unlawful content (Section 9)',
        labelEn: 'Unlawful content (Section 9)',
        descriptionDe: 'Violates applicable law or encourages illegal acts.',
        descriptionEn: 'Violates applicable law or encourages illegal acts.',
        contentDe: '',
        contentEn: '',
        sortOrder: 20,
        isActive: 1
    },
    {
        key: 'third_party_rights_infringement',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Third-party rights infringement (Section 9)',
        labelEn: 'Third-party rights infringement (Section 9)',
        descriptionDe: 'Violates copyright, trademark, personality, or data protection rights.',
        descriptionEn: 'Violates copyright, trademark, personality, or data protection rights.',
        contentDe: '',
        contentEn: '',
        sortOrder: 30,
        isActive: 1
    },
    {
        key: 'privacy_or_personal_data_disclosure',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Privacy or personal data disclosure (Section 9)',
        labelEn: 'Privacy or personal data disclosure (Section 9)',
        descriptionDe: 'Shares personal data without consent.',
        descriptionEn: 'Shares personal data without consent.',
        contentDe: '',
        contentEn: '',
        sortOrder: 40,
        isActive: 1
    },
    {
        key: 'statutory_notice_or_dsa_procedure',
        type: TEXT_BLOCK_TYPES.LEGAL_BASIS,
        labelDe: 'Statutory notice or DSA procedure (Section 8)',
        labelEn: 'Statutory notice or DSA procedure (Section 8)',
        descriptionDe: 'Action required under legal obligations or a DSA notice.',
        descriptionEn: 'Action required under legal obligations or a DSA notice.',
        contentDe: '',
        contentEn: '',
        sortOrder: 50,
        isActive: 1
    },
    {
        key: 'tos_hate_harassment_threats',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Section 9 - Hate speech, harassment, or threats',
        labelEn: 'Section 9 - Hate speech, harassment, or threats',
        descriptionDe: 'Hate speech, targeted harassment, or threats against individuals or groups.',
        descriptionEn: 'Hate speech, targeted harassment, or threats against individuals or groups.',
        contentDe: '',
        contentEn: '',
        sortOrder: 10,
        isActive: 1
    },
    {
        key: 'tos_violence',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Section 9 - Violence or glorification of violence',
        labelEn: 'Section 9 - Violence or glorification of violence',
        descriptionDe: 'Threats, glorification of violence, or incitement.',
        descriptionEn: 'Threats, glorification of violence, or incitement.',
        contentDe: '',
        contentEn: '',
        sortOrder: 20,
        isActive: 1
    },
    {
        key: 'tos_harmful_to_minors',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Section 9 - Sexual or harmful-to-minors content',
        labelEn: 'Section 9 - Sexual or harmful-to-minors content',
        descriptionDe: 'Sexually explicit or harmful-to-minors content.',
        descriptionEn: 'Sexually explicit or harmful-to-minors content.',
        contentDe: '',
        contentEn: '',
        sortOrder: 30,
        isActive: 1
    },
    {
        key: 'tos_privacy_or_personal_data_disclosure',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Section 9 - Privacy or personal data disclosure',
        labelEn: 'Section 9 - Privacy or personal data disclosure',
        descriptionDe: 'Doxxing or sharing personal data without consent.',
        descriptionEn: 'Doxxing or sharing personal data without consent.',
        contentDe: '',
        contentEn: '',
        sortOrder: 40,
        isActive: 1
    },
    {
        key: 'tos_fraud_scams_or_spam',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Section 9 - Fraud, scams, or spam',
        labelEn: 'Section 9 - Fraud, scams, or spam',
        descriptionDe: 'Fraudulent, manipulative, or spam content.',
        descriptionEn: 'Fraudulent, manipulative, or spam content.',
        contentDe: '',
        contentEn: '',
        sortOrder: 50,
        isActive: 1
    },
    {
        key: 'tos_intellectual_property_or_third_party_rights',
        type: TEXT_BLOCK_TYPES.TOS_CLAUSE,
        labelDe: 'Section 9 - Intellectual property or third-party rights',
        labelEn: 'Section 9 - Intellectual property or third-party rights',
        descriptionDe: 'Copyright, trademark, or other third-party rights violations.',
        descriptionEn: 'Copyright, trademark, or other third-party rights violations.',
        contentDe: '',
        contentEn: '',
        sortOrder: 60,
        isActive: 1
    }
];

module.exports = {
    TEXT_BLOCK_TYPES,
    DEFAULT_DSA_TEXT_BLOCKS
};
