/**
 * Middleware de validation avec Joi
 * Valide les données de req.body, req.query ou req.params
 */

/**
 * Valide les données selon un schéma Joi
 * @param {Object} schema - Schéma Joi de validation
 * @param {string} source - Source des données ('body', 'query', 'params')
 * @returns Middleware function
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];

    const { error, value } = schema.validate(data, {
      abortEarly: false, // Retourne toutes les erreurs, pas seulement la première
      stripUnknown: true, // Supprime les champs non définis dans le schéma
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return res.status(400).json({
        success: false,
        message: 'Erreur de validation des données.',
        errors,
      });
    }

    // Remplacer les données par les données validées (nettoyées)
    req[source] = value;
    next();
  };
};

/**
 * Valide le body de la requête
 */
const validateBody = (schema) => validate(schema, 'body');

/**
 * Valide les query params
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Valide les params d'URL
 */
const validateParams = (schema) => validate(schema, 'params');

module.exports = {
  validate,
  validateBody,
  validateQuery,
  validateParams,
};
