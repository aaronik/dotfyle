import type { NeovimConfig, NeovimPluginManager } from '@prisma/client';
import { prismaClient } from '../client';
import type {
	CreateNeovimConfigDTO,
	NeovimConfigWithMetaData,
	NeovimConfigWithPlugins,
	NestedNeovimConfigWithMetaData,
	NestedNeovimConfigWithPlugins
} from './schema';

export async function getConfigsForPlugin(owner: string, name: string): Promise<NeovimConfigWithMetaData[]> {
	const configs = await prismaClient.neovimConfig.findMany({
		include: {
			user: {
				select: {
					avatarUrl: true
				}
			},
      _count: {
        select: {
          neovimConfigPlugins: true,
        },
      },
		},
		where: {
      neovimConfigPlugins: {
        some: {
          plugin: {
            owner,
            name
          }
        }
      }
		},
		orderBy: [
			{
				stars: 'desc'
			},
			{
				repo: 'asc'
			},
			{
				root: 'asc'
			}
		]
	});
	return configs.map(attachMetaData);
}

export async function getConfigBySlug(
	owner: string,
	slug: string
): Promise<NeovimConfigWithMetaData> {
	const config = await prismaClient.neovimConfig.findFirstOrThrow({
		include: {
			user: {
				select: {
					avatarUrl: true
				}
			},
      _count: {
        select: {
          neovimConfigPlugins: true,
        },
      },
		},
		where: {
			slug,
			user: {
				username: owner
			}
		},
		orderBy: [
			{
				stars: 'desc'
			},
			{
				repo: 'asc'
			},
			{
				root: 'asc'
			}
		]
	});
	return attachMetaData(config);
}

export async function getConfigsByUsername(username: string): Promise<NeovimConfigWithMetaData[]> {
	const configs = await prismaClient.neovimConfig.findMany({
		include: {
			user: { select: { avatarUrl: true } },
      _count: {
        select: {
          neovimConfigPlugins: true,
        },
      },
		},
		where: { user: { username } },
		orderBy: [{ stars: 'desc' }, { repo: 'asc' }, { root: 'asc' }]
	});
	return configs.map(attachMetaData);
}
export async function upsertNeovimConfig(
	userId: number,
	config: CreateNeovimConfigDTO
): Promise<NeovimConfig> {
  const lastSyncedAt = new Date()
	const { owner, repo, root } = config;
	const data = { userId, lastSyncedAt,  ...config };
	const user = await prismaClient.neovimConfig.upsert({
		where: { owner_repo_root: { owner, repo, root } },
		create: data,
		update: data
	});
	return user;
}

export async function updatePluginManager(
	id: number,
	pluginManager: NeovimPluginManager
): Promise<NeovimConfig> {
	const config = await prismaClient.neovimConfig.update({ where: { id }, data: { pluginManager } });
	return config;
}

export async function getConfigWithPlugins(id: number): Promise<NeovimConfigWithPlugins> {
	const config = await prismaClient.neovimConfig.findUniqueOrThrow({
		where: {
			id
		},
		include: {
			neovimConfigPlugins: {
				include: {
					plugin: true
				}
			}
		}
	});
	return attachPlugins(config);
}

export async function addPlugins(
	configId: number,
	pluginIds: number[]
): Promise<NeovimConfigWithPlugins> {
	// TODO: add sync id in create, or maybe config.sha?
	const upsert = pluginIds.map((pluginId) => ({
		where: {
			configId_pluginId: {
				configId,
				pluginId
			}
		},
		update: {
			plugin: {
				connect: {
					id: pluginId
				}
			}
		},
		create: {
			plugin: {
				connect: {
					id: pluginId
				}
			}
		}
	}));
	return await prismaClient.neovimConfig
		.update({
			include: {
				neovimConfigPlugins: {
					include: {
						plugin: true
					}
				}
			},
			where: { id: configId },
			data: {
				neovimConfigPlugins: {
					upsert
				}
			}
		})
		.then(attachPlugins);
}

export async function searchNeovimConfigs() {
	const configs = await prismaClient.neovimConfig.findMany({
		include: {
			user: {
				select: {
					avatarUrl: true
				}
			},
      _count: {
        select: {
          neovimConfigPlugins: true,
        },
      },
		},
		orderBy: {
			createdAt: 'desc'
		},
	});

	return configs.map(attachMetaData);
}

export async function getNewestNeovimConfigs(): Promise<NeovimConfigWithMetaData[]> {
	const configs = await prismaClient.neovimConfig.findMany({
		include: {
			user: {
				select: {
					avatarUrl: true
				}
			},
      _count: {
        select: {
          neovimConfigPlugins: true,
        },
      },
		},
		orderBy: {
			createdAt: 'desc'
		},
		take: 6
	});

	return configs.map(attachMetaData);
}

function attachMetaData({
	_count,
	user,
	...config
}: NestedNeovimConfigWithMetaData): NeovimConfigWithMetaData {
	return {
		...config,
		ownerAvatar: user.avatarUrl,
		pluginCount: _count.neovimConfigPlugins,
	};
}

function attachPlugins({
	neovimConfigPlugins,
	...config
}: NestedNeovimConfigWithPlugins): NeovimConfigWithPlugins {
	return {
		...config,
		plugins: neovimConfigPlugins.map((p) => p.plugin)
	};
}
