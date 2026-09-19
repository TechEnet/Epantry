import { apiClient, } from '../../../api/apiClient';

function unwrapApiData(response) {
    if (response?.data &&
        typeof response.data ===
            'object' &&
        Object.prototype.hasOwnProperty.call(response.data, 'success')) {
        return response.data.data;
    }

    return response?.data ??
        response;
}

function normalizeQueryParams(values) {
    const result = {};

    for (const [key, value] of Object.entries(values || {})) {
        if (value === undefined ||
            value === null ||
            value === '') {
            continue;
        }

        if (Array.isArray(value)) {
            if (value.length) {
                result[key] = value.join(',');
            }

            continue;
        }

        result[key] = value;
    }

    return result;
}

async function requestCsrfToken() {
    const response =
        await apiClient.get('/auth/csrf');

    const data =
        unwrapApiData(response);

    if (!data?.csrfToken) {
        throw new Error(
            'Unable to establish CSRF protection for this administrative action.',
        );
    }

    return data.csrfToken;
}

async function mutate({
    method = 'post',
    url,
    data = {},
}) {
    const csrfToken =
        await requestCsrfToken();

    return unwrapApiData(
        await apiClient.request({
            method,
            url,
            data,
            headers: {
                'x-csrf-token':
                    csrfToken,
            },
        }),
    );
}

export function getAdminGovernanceErrorMessage(
    error,
    fallback = 'Unable to complete this governance operation.',
) {
    return error?.response?.data?.message ||
        error?.message ||
        fallback;
}

export async function getAdminCommandCenter() {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/command-center',
        ),
    );
}

export async function searchAdminGovernance({
    q,
    limit = 25,
    types = [],
}) {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/search',
            {
                params:
                    normalizeQueryParams({
                        q,
                        limit,
                        types,
                    }),
            },
        ),
    );
}

export async function listAdminReviewCases(params = {}) {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/review-cases',
            {
                params:
                    normalizeQueryParams(params),
            },
        ),
    );
}

export async function getAdminReviewCase(reviewCaseId) {
    return unwrapApiData(
        await apiClient.get(
            `/admin/governance/review-cases/${encodeURIComponent(String(reviewCaseId))}`,
        ),
    );
}

export async function createAdminReviewCase(input) {
    return mutate({
        url:
            '/admin/governance/review-cases',
        data:
            input,
    });
}

export async function assignAdminReviewCase(
    reviewCaseId,
    input,
) {
    return mutate({
        url:
            `/admin/governance/review-cases/${encodeURIComponent(String(reviewCaseId))}/assign`,
        data:
            input,
    });
}

export async function decideAdminReviewCase(
    reviewCaseId,
    input,
) {
    return mutate({
        url:
            `/admin/governance/review-cases/${encodeURIComponent(String(reviewCaseId))}/decision`,
        data:
            input,
    });
}

export async function listAdminIncidents(params = {}) {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/incidents',
            {
                params:
                    normalizeQueryParams(params),
            },
        ),
    );
}

export async function createAdminIncident(input) {
    return mutate({
        url:
            '/admin/governance/incidents',
        data:
            input,
    });
}

export async function updateAdminIncident(
    incidentId,
    input,
) {
    return mutate({
        method:
            'patch',
        url:
            `/admin/governance/incidents/${encodeURIComponent(String(incidentId))}`,
        data:
            input,
    });
}

export async function listAdminSupportCases(params = {}) {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/support-cases',
            {
                params:
                    normalizeQueryParams(params),
            },
        ),
    );
}

export async function createAdminSupportCase(input) {
    return mutate({
        url:
            '/admin/governance/support-cases',
        data:
            input,
    });
}

export async function updateAdminSupportCase(
    supportCaseId,
    input,
) {
    return mutate({
        method:
            'patch',
        url:
            `/admin/governance/support-cases/${encodeURIComponent(String(supportCaseId))}`,
        data:
            input,
    });
}

export async function getAdminPolicyOverview() {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/policy',
        ),
    );
}

export async function listAdminFeatureFlags(params = {}) {
    return unwrapApiData(
        await apiClient.get(
            '/admin/governance/feature-flags',
            {
                params:
                    normalizeQueryParams(params),
            },
        ),
    );
}

export async function createAdminFeatureFlag(input) {
    return mutate({
        url:
            '/admin/governance/feature-flags',
        data:
            input,
    });
}

export async function updateAdminFeatureFlag(
    featureFlagId,
    input,
) {
    return mutate({
        method:
            'patch',
        url:
            `/admin/governance/feature-flags/${encodeURIComponent(String(featureFlagId))}`,
        data:
            input,
    });
}

export async function executeAdminGovernanceAction(input) {
    return mutate({
        url:
            '/admin/governance/actions/execute',
        data:
            input,
    });
}