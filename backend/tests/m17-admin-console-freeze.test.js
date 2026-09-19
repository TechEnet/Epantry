import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename =
    fileURLToPath(
        import.meta.url,
    );

const __dirname =
    path.dirname(
        __filename,
    );

const projectRoot =
    path.resolve(
        __dirname,
        '..',
        '..',
    );

function readFrontend(relativePath) {
    return fs.readFileSync(
        path.join(
            projectRoot,
            'frontend',
            relativePath,
        ),
        'utf8',
    );
}

function stripComments(source) {
    return source
        .replace(
            /\/\*[\s\S]*?\*\//g,
            '',
        )
        .replace(
            /(^|[^:])\/\/.*$/gm,
            '$1',
        );
}

test(
    'M17 Batch 2 preserves Customer Host Super Admin application access model',
    () => {
        const source =
            stripComments(
                [
                    'src/routes/AppRoutes.jsx',
                    'src/features/admin/components/AdminShell.jsx',
                    'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
                ]
                    .map(
                        readFrontend,
                    )
                    .join('\n'),
            );

        for (const forbidden of [
            'sellerEnabled',
            'brandEnabled',
            'b2bEnabled',
        ]) {
            assert.equal(
                source.includes(
                    forbidden,
                ),
                false,
                `${forbidden} must not be introduced by M17.`,
            );
        }

        assert.doesNotMatch(
            source,
            /activeMode/,
        );
    },
);

test(
    'M17 preserves frozen Host frontend authorization semantics',
    () => {
        const source =
            readFrontend(
                'src/routes/AppRoutes.jsx',
            );

        assert.match(
            source,
            /hostEnabled === true && hostAccessStatus === 'active'/,
        );
    },
);

test(
    'M17 A02-A21 routes are backend-permission gated',
    () => {
        const source =
            readFrontend(
                'src/routes/AppRoutes.jsx',
            );

        for (const route of [
            '/admin/users-organizations',
            '/admin/data-quality',
            '/admin/recipe-review',
            '/admin/orders-disputes',
            '/admin/finance-ops',
            '/admin/integrations',
            '/admin/policy',
            '/admin/cms',
            '/admin/trust-safety',
            '/admin/privacy',
            '/admin/ad-review',
            '/admin/ai-quality',
        ]) {
            const index =
                source.indexOf(
                    `path="${route}"`,
                );

            assert.notEqual(
                index,
                -1,
                `${route} must exist.`,
            );

            const block =
                source.slice(
                    index,
                    index + 850,
                );

            assert.match(
                block,
                /AdminPermissionRoute/,
                `${route} must stay inside AdminPermissionRoute.`,
            );
        }
    },
);

test(
    'M17 preserves existing specialist admin routes instead of replacing them',
    () => {
        const source =
            readFrontend(
                'src/routes/AppRoutes.jsx',
            );

        for (const route of [
            '/admin/catalog',
            '/admin/catalog/ingredients',
            '/admin/brands',
            '/admin/recipes',
            '/admin/food-intelligence',
            '/admin/product-intelligence',
            '/admin/community',
            '/admin/marketplace',
            '/admin/hosts',
            '/admin/host-operations',
            '/admin/roles',
            '/admin/audit',
        ]) {
            assert.equal(
                source.includes(
                    `path="${route}"`,
                ),
                true,
                `${route} must remain wired.`,
            );
        }
    },
);

test(
    'M17 governance frontend uses API service and never imports persistence models',
    () => {
        const source =
            [
                'src/features/adminGovernance/services/adminGovernance.service.js',
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
                'src/features/adminGovernance/components/AdminGlobalSearch.jsx',
            ]
                .map(
                    readFrontend,
                )
                .join('\n');

        assert.doesNotMatch(
            source,
            /mongoose|ProductVersion\.update|RecipeVersion\.update|SellerOrder\.update|HostSettlement\.update/,
        );

        assert.match(
            source,
            /\/admin\/governance\//,
        );
    },
);

test(
    'M17 UI does not claim an ad auction serving ROAS billing or retailer adapter engine',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /No auction, paid ranking, serving, billing or ROAS engine is introduced here/,
        );

        assert.match(
            source,
            /does not invent retailer adapters or delivery workers/,
        );
    },
);

test(
    'M17 UI keeps M11 ledger and M16 settlement ownership explicit',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /cannot rewrite CommerceLedgerEntry history/,
        );

        assert.match(
            source,
            /Settlement creation, checker approval and paid reconciliation remain on the frozen M16 finance surface/,
        );
    },
);

test(
    'M17 console states direct database editing is not the operating model',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/pages/AdminGovernancePage.jsx',
            );

        assert.match(
            source,
            /Direct database editing is not an M17 operating model/,
        );
    },
);

test(
    'M17 global search explicitly states backend permission filtering',
    () => {
        const source =
            readFrontend(
                'src/features/adminGovernance/components/AdminGlobalSearch.jsx',
            );

        assert.match(
            source,
            /backend-resolved M03 permissions/,
        );

        assert.match(
            source,
            /Search never grants mutation authority/,
        );
    },
);