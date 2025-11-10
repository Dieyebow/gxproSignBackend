const Client = require('../models/Client');
const User = require('../models/User');
const Document = require('../models/Document');
const Envelope = require('../models/Envelope');
const Signature = require('../models/Signature');
const AuditLog = require('../models/AuditLog');

/**
 * Get dashboard overview statistics
 * For SuperAdmin: Global stats across all clients
 * For Admin B2B: Stats for their client only
 */
const getOverviewStats = async (req, res) => {
  try {
    const { role, clientId } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN';

    // Build query filter based on role
    const clientFilter = isSuperAdmin ? {} : { clientId };

    // 1. Total counts
    const [totalClients, totalUsers, totalDocuments, totalEnvelopes, totalSignatures] = await Promise.all([
      isSuperAdmin ? Client.countDocuments({ status: { $ne: 'DELETED' } }) : 1,
      User.countDocuments({ ...clientFilter, status: { $ne: 'DELETED' } }),
      Document.countDocuments({ ...clientFilter, status: { $ne: 'DELETED' } }),
      Envelope.countDocuments(clientFilter),
      Signature.countDocuments(clientFilter),
    ]);

    // 2. Active users (logged in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({
      ...clientFilter,
      lastLogin: { $gte: thirtyDaysAgo },
      status: 'ACTIVE',
    });

    // 3. Envelope status breakdown
    const envelopeStats = await Envelope.aggregate([
      { $match: clientFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const envelopesByStatus = {
      DRAFT: 0,
      SENT: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    };

    envelopeStats.forEach(stat => {
      envelopesByStatus[stat._id] = stat.count;
    });

    // 4. Completion rate
    const completedEnvelopes = envelopesByStatus.COMPLETED;
    const totalSentEnvelopes = totalEnvelopes - envelopesByStatus.DRAFT;
    const completionRate = totalSentEnvelopes > 0
      ? ((completedEnvelopes / totalSentEnvelopes) * 100).toFixed(2)
      : 0;

    // 5. Storage usage (sum of all document file sizes)
    const storageStats = await Document.aggregate([
      { $match: { ...clientFilter, status: { $ne: 'DELETED' } } },
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$file.fileSize' },
        },
      },
    ]);

    const totalStorageBytes = storageStats.length > 0 ? storageStats[0].totalSize : 0;
    const totalStorageGB = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

    // 6. Recent activity (last 10 audit logs)
    const recentActivity = await AuditLog.find(
      isSuperAdmin ? {} : { clientId }
    )
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'firstName lastName email')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalClients: isSuperAdmin ? totalClients : null,
          totalUsers,
          totalDocuments,
          totalEnvelopes,
          totalSignatures,
          activeUsers,
          completionRate: parseFloat(completionRate),
          totalStorageGB: parseFloat(totalStorageGB),
        },
        envelopes: envelopesByStatus,
        recentActivity: recentActivity.map(log => ({
          id: log._id,
          action: log.action,
          description: log.description,
          user: log.userId ? {
            name: `${log.userId.firstName} ${log.userId.lastName}`,
            email: log.userId.email,
          } : null,
          ipAddress: log.metadata?.ipAddress,
          timestamp: log.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error in getOverviewStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message,
    });
  }
};

/**
 * Get monthly trends for charts
 * Returns data for the last 12 months
 */
const getMonthlyTrends = async (req, res) => {
  try {
    const { role, clientId } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const clientFilter = isSuperAdmin ? {} : { clientId };

    // Calculate date range (last 12 months)
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // 1. Documents uploaded per month
    const documentsPerMonth = await Document.aggregate([
      {
        $match: {
          ...clientFilter,
          createdAt: { $gte: twelveMonthsAgo },
          status: { $ne: 'DELETED' },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // 2. Envelopes created per month
    const envelopesPerMonth = await Envelope.aggregate([
      {
        $match: {
          ...clientFilter,
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // 3. Signatures completed per month
    const signaturesPerMonth = await Signature.aggregate([
      {
        $match: {
          ...clientFilter,
          createdAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // 4. New users per month
    const usersPerMonth = await User.aggregate([
      {
        $match: {
          ...clientFilter,
          createdAt: { $gte: twelveMonthsAgo },
          status: { $ne: 'DELETED' },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Format data for frontend charts
    const formatMonthlyData = (data) => {
      const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
      const result = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        const dataPoint = data.find(d => d._id.year === year && d._id.month === month);

        result.push({
          month: `${monthNames[date.getMonth()]} ${year}`,
          year,
          monthNumber: month,
          count: dataPoint ? dataPoint.count : 0,
        });
      }

      return result;
    };

    return res.status(200).json({
      success: true,
      data: {
        documents: formatMonthlyData(documentsPerMonth),
        envelopes: formatMonthlyData(envelopesPerMonth),
        signatures: formatMonthlyData(signaturesPerMonth),
        users: formatMonthlyData(usersPerMonth),
      },
    });
  } catch (error) {
    console.error('Error in getMonthlyTrends:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des tendances mensuelles',
      error: error.message,
    });
  }
};

/**
 * Get client-specific statistics
 * SuperAdmin only: Get detailed stats for a specific client
 */
const getClientStats = async (req, res) => {
  try {
    const { id: clientId } = req.params;

    // Verify client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé',
      });
    }

    // Get statistics
    const [totalUsers, totalDocuments, totalEnvelopes, totalSignatures] = await Promise.all([
      User.countDocuments({ clientId, status: { $ne: 'DELETED' } }),
      Document.countDocuments({ clientId, status: { $ne: 'DELETED' } }),
      Envelope.countDocuments({ clientId }),
      Signature.countDocuments({ clientId }),
    ]);

    // Active users (logged in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeUsers = await User.countDocuments({
      clientId,
      lastLogin: { $gte: thirtyDaysAgo },
      status: 'ACTIVE',
    });

    // Storage usage
    const storageStats = await Document.aggregate([
      { $match: { clientId, status: { $ne: 'DELETED' } } },
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$file.fileSize' },
        },
      },
    ]);

    const totalStorageBytes = storageStats.length > 0 ? storageStats[0].totalSize : 0;
    const totalStorageGB = (totalStorageBytes / (1024 * 1024 * 1024)).toFixed(2);

    // Documents this month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const documentsThisMonth = await Document.countDocuments({
      clientId,
      createdAt: { $gte: startOfMonth },
      status: { $ne: 'DELETED' },
    });

    // Envelope completion rate
    const completedEnvelopes = await Envelope.countDocuments({ clientId, status: 'COMPLETED' });
    const completionRate = totalEnvelopes > 0
      ? ((completedEnvelopes / totalEnvelopes) * 100).toFixed(2)
      : 0;

    // Usage vs limits
    const limits = client.limits;
    const usagePercentage = {
      documents: limits.maxDocumentsPerMonth > 0
        ? ((documentsThisMonth / limits.maxDocumentsPerMonth) * 100).toFixed(2)
        : 0,
      users: limits.maxUsers > 0
        ? ((totalUsers / limits.maxUsers) * 100).toFixed(2)
        : 0,
      storage: limits.maxStorageGB > 0
        ? ((parseFloat(totalStorageGB) / limits.maxStorageGB) * 100).toFixed(2)
        : 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        client: {
          id: client._id,
          companyName: client.companyName,
          subdomain: client.subdomain,
          status: client.status,
          subscription: client.subscription,
        },
        statistics: {
          totalUsers,
          activeUsers,
          totalDocuments,
          documentsThisMonth,
          totalEnvelopes,
          totalSignatures,
          completionRate: parseFloat(completionRate),
          storageUsedGB: parseFloat(totalStorageGB),
        },
        limits: {
          maxDocumentsPerMonth: limits.maxDocumentsPerMonth,
          maxUsers: limits.maxUsers,
          maxStorageGB: limits.maxStorageGB,
        },
        usagePercentage: {
          documents: parseFloat(usagePercentage.documents),
          users: parseFloat(usagePercentage.users),
          storage: parseFloat(usagePercentage.storage),
        },
      },
    });
  } catch (error) {
    console.error('Error in getClientStats:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques du client',
      error: error.message,
    });
  }
};

/**
 * Get signature analytics
 * Detailed analytics about signature methods, average time to sign, etc.
 */
const getSignatureAnalytics = async (req, res) => {
  try {
    const { role, clientId } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const clientFilter = isSuperAdmin ? {} : { clientId };

    // 1. Signature methods breakdown
    const signatureMethodsStats = await Signature.aggregate([
      { $match: clientFilter },
      {
        $group: {
          _id: '$signatureMethod',
          count: { $sum: 1 },
        },
      },
    ]);

    const signatureMethods = {
      DRAW: 0,
      TYPE: 0,
      UPLOAD: 0,
      BIOMETRIC: 0,
    };

    signatureMethodsStats.forEach(stat => {
      signatureMethods[stat._id] = stat.count;
    });

    // 2. Average time to sign (from envelope sent to signature)
    const envelopesWithSignatures = await Envelope.aggregate([
      { $match: { ...clientFilter, status: 'COMPLETED' } },
      { $unwind: '$recipients' },
      {
        $match: {
          'recipients.status': 'SIGNED',
          'recipients.sentAt': { $exists: true },
          'recipients.signedAt': { $exists: true },
        },
      },
      {
        $project: {
          timeToSign: {
            $subtract: ['$recipients.signedAt', '$recipients.sentAt'],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTimeToSign: { $avg: '$timeToSign' },
          minTimeToSign: { $min: '$timeToSign' },
          maxTimeToSign: { $max: '$timeToSign' },
          totalSignatures: { $sum: 1 },
        },
      },
    ]);

    const timeStats = envelopesWithSignatures.length > 0 ? {
      avgTimeToSignHours: (envelopesWithSignatures[0].avgTimeToSign / (1000 * 60 * 60)).toFixed(2),
      minTimeToSignHours: (envelopesWithSignatures[0].minTimeToSign / (1000 * 60 * 60)).toFixed(2),
      maxTimeToSignHours: (envelopesWithSignatures[0].maxTimeToSign / (1000 * 60 * 60)).toFixed(2),
      totalSignatures: envelopesWithSignatures[0].totalSignatures,
    } : {
      avgTimeToSignHours: 0,
      minTimeToSignHours: 0,
      maxTimeToSignHours: 0,
      totalSignatures: 0,
    };

    // 3. Device type breakdown
    const deviceStats = await Signature.aggregate([
      { $match: clientFilter },
      {
        $group: {
          _id: '$metadata.deviceType',
          count: { $sum: 1 },
        },
      },
    ]);

    const deviceTypes = {
      desktop: 0,
      mobile: 0,
      tablet: 0,
      unknown: 0,
    };

    deviceStats.forEach(stat => {
      const deviceType = stat._id || 'unknown';
      deviceTypes[deviceType] = stat.count;
    });

    // 4. Decline rate
    const totalEnvelopes = await Envelope.countDocuments(clientFilter);
    const declinedRecipients = await Envelope.aggregate([
      { $match: clientFilter },
      { $unwind: '$recipients' },
      { $match: { 'recipients.status': 'DECLINED' } },
      { $count: 'total' },
    ]);

    const declineCount = declinedRecipients.length > 0 ? declinedRecipients[0].total : 0;
    const declineRate = totalEnvelopes > 0
      ? ((declineCount / totalEnvelopes) * 100).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        signatureMethods,
        timeToSign: {
          avgHours: parseFloat(timeStats.avgTimeToSignHours),
          minHours: parseFloat(timeStats.minTimeToSignHours),
          maxHours: parseFloat(timeStats.maxTimeToSignHours),
          totalSignatures: timeStats.totalSignatures,
        },
        deviceTypes,
        declineRate: parseFloat(declineRate),
        declineCount,
      },
    });
  } catch (error) {
    console.error('Error in getSignatureAnalytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analytics de signature',
      error: error.message,
    });
  }
};

/**
 * Get user activity report
 * Shows most active users, their document uploads, envelopes created, etc.
 */
const getUserActivity = async (req, res) => {
  try {
    const { role, clientId } = req.user;
    const isSuperAdmin = role === 'SUPER_ADMIN';
    const clientFilter = isSuperAdmin ? {} : { clientId };

    // Get top 10 most active users by document uploads
    const topUsersByDocuments = await Document.aggregate([
      { $match: { ...clientFilter, status: { $ne: 'DELETED' } } },
      {
        $group: {
          _id: '$uploadedBy',
          documentCount: { $sum: 1 },
        },
      },
      { $sort: { documentCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          email: '$user.email',
          role: '$user.role',
          documentCount: 1,
        },
      },
    ]);

    // Get top 10 most active users by envelopes sent
    const topUsersByEnvelopes = await Envelope.aggregate([
      { $match: clientFilter },
      {
        $group: {
          _id: '$sender',
          envelopeCount: { $sum: 1 },
        },
      },
      { $sort: { envelopeCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: '$_id',
          name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          email: '$user.email',
          role: '$user.role',
          envelopeCount: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        topUsersByDocuments,
        topUsersByEnvelopes,
      },
    });
  } catch (error) {
    console.error('Error in getUserActivity:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'activité utilisateur',
      error: error.message,
    });
  }
};

module.exports = {
  getOverviewStats,
  getMonthlyTrends,
  getClientStats,
  getSignatureAnalytics,
  getUserActivity,
};
