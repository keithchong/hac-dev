import {
  k8sListResourceItems,
  k8sCreateResource,
  k8sUpdateResource,
  commonFetch,
} from '@openshift/dynamic-plugin-sdk-utils';
import isEqual from 'lodash/isEqual';
import isNumber from 'lodash/isNumber';
import { v4 as uuidv4 } from 'uuid';
import {
  getRandomSvgNumber,
  THUMBNAIL_ANNOTATION,
} from '../components/ApplicationDetails/ApplicationThumbnail';
import { ImportSecret } from '../components/ImportForm/utils/types';
import {
  PartnerTask,
  SNYK_SPI_TOKEN_ACCESS_BINDING,
  createSecretResource,
  supportedPartnerTasksSecrets,
} from '../components/Secrets/secret-utils';
import {
  ApplicationModel,
  ComponentModel,
  ComponentDetectionQueryModel,
  SPIAccessTokenBindingModel,
  SecretModel,
} from '../models';
import {
  ComponentKind,
  ApplicationKind,
  ComponentDetectionQueryKind,
  SPIAccessTokenBindingKind,
} from '../types';
import { PIPELINE_SERVICE_ACCOUNT } from './../consts/pipeline';
import { ComponentSpecs } from './../types/component';
import { PAC_ANNOTATION } from './component-utils';

export const sanitizeName = (name: string) => name.split(/ |\./).join('-').toLowerCase();
/**
 * Create HAS Application CR
 * @param application application name
 * @param namespace namespace of the application
 * @param dryRun dry run without creating any resources
 * @returns Returns HAS Application CR data
 *
 * TODO: Return type any should be changed to a proper type like K8sResourceCommon
 */
export const createApplication = (
  application: string,
  namespace: string,
  dryRun?: boolean,
): Promise<ApplicationKind> => {
  const requestData = {
    apiVersion: `${ApplicationModel.apiGroup}/${ApplicationModel.apiVersion}`,
    kind: ApplicationModel.kind,
    metadata: {
      name: application,
      namespace,
      annotations: {
        [THUMBNAIL_ANNOTATION]: getRandomSvgNumber().toString(),
      },
    },
    spec: {
      displayName: application,
    },
  };

  return k8sCreateResource({
    model: ApplicationModel,
    queryOptions: {
      name: application,
      ns: namespace,
      ...(dryRun && { queryParams: { dryRun: 'All' } }),
    },
    resource: requestData,
  });
};

/**
 * Create HAS Component CR
 *
 * @param component component data
 * @param application application name
 * @param namespace namespace of the application
 * @param dryRun dry run without creating any resources
 * @param annotations optional set of additional annotations
 * @returns Returns HAS Component CR data
 *
 * TODO: Return type any should be changed to a proper type like K8sResourceCommon
 */
export const createComponent = (
  // TODO need better type for `component`
  component: ComponentSpecs,
  application: string,
  namespace: string,
  secret?: string,
  dryRun?: boolean,
  originalComponent?: ComponentKind,
  verb: 'create' | 'update' = 'create',
  enablePac: boolean = false,
  annotations?: { [key: string]: string },
) => {
  const { componentName, containerImage, source, replicas, resources, env, targetPort } = component;

  const name = component.componentName.split(/ |\./).join('-').toLowerCase();

  const newComponent = {
    apiVersion: `${ComponentModel.apiGroup}/${ComponentModel.apiVersion}`,
    kind: ComponentModel.kind,
    metadata: {
      name,
      namespace,
      ...(verb === 'create' &&
        (enablePac
          ? {
              annotations: {
                'image.redhat.com/generate': 'true',
                [PAC_ANNOTATION]: 'request',
              },
            }
          : {
              annotations: {
                'image.redhat.com/generate': 'true',
                'skip-initial-checks': 'true',
              },
            })),
    },
    spec: {
      componentName,
      application,
      source,
      secret,
      containerImage,
      replicas,
      ...(isNumber(targetPort) && { targetPort }),
      resources,
      env,
    },
  };

  const resource =
    verb === 'update' ? { ...originalComponent, spec: newComponent.spec } : newComponent;

  // merge additional annotations
  if (annotations) {
    resource.metadata.annotations = { ...resource.metadata.annotations, ...annotations };
  }

  return verb === 'create'
    ? k8sCreateResource<ComponentKind>({
        model: ComponentModel,
        queryOptions: {
          name,
          ns: namespace,
          ...(dryRun && { queryParams: { dryRun: 'All' } }),
        },
        resource,
      })
    : k8sUpdateResource<ComponentKind>({ model: ComponentModel, resource });
};

/**
 * Create ComponentDetectionQuery CR
 *
 * @param url the URL of the repository that will be analyzed for components
 * @param namespace namespace to deploy resource in. Defaults to current namespace
 * @param secret Name of the secret containing the personal access token
 * @param context Context directory
 * @param revision Git revision if other than master/main
 * @param dryRun dry run without creating any resources
 * @returns Returns CDQ
 *
 */
export const createComponentDetectionQuery = async (
  url: string,
  namespace: string,
  secret?: string,
  context?: string,
  revision?: string,
  dryRun?: boolean,
): Promise<ComponentDetectionQueryKind> => {
  // append name with uid for additional randomness
  const uniqueName = `cdq-${uuidv4()}`;

  const requestData = {
    apiVersion: `${ComponentDetectionQueryModel.apiGroup}/${ComponentDetectionQueryModel.apiVersion}`,
    kind: ComponentDetectionQueryModel.kind,
    metadata: {
      name: uniqueName,
      namespace,
    },
    spec: {
      git: {
        url,
        context,
        revision,
      },
      secret,
    },
  };

  return k8sCreateResource({
    model: ComponentDetectionQueryModel,
    queryOptions: {
      name: uniqueName,
      ns: namespace,
      ...(dryRun && { queryParams: { dryRun: 'All' } }),
    },
    resource: requestData,
  });
};

/**
 * Create SPIAccessTokenBinding CR
 *
 * @param url the URL of the git repository
 * @param namespace namespace to create the binding
 * @param dryRun dry run without creating any resources
 * @returns Returns created SPIAccessTokenBinding resource
 */
export const createAccessTokenBinding = async (
  url: string,
  namespace: string,
  dryRun?: boolean,
) => {
  const id = uuidv4();
  const requestData = {
    apiVersion: `${SPIAccessTokenBindingModel.apiGroup}/${SPIAccessTokenBindingModel.apiVersion}`,
    kind: SPIAccessTokenBindingModel.kind,
    metadata: {
      name: `appstudio-import-${id}`,
      namespace,
    },
    spec: {
      repoUrl: url,
      permissions: {
        required: [
          { type: 'r', area: 'repository' },
          { type: 'w', area: 'repository' },
        ],
      },
      secret: {
        name: `appstudio-token-${id}`,
        type: 'kubernetes.io/basic-auth',
      },
    },
  };

  const binding: SPIAccessTokenBindingKind = await k8sCreateResource({
    model: SPIAccessTokenBindingModel,
    queryOptions: {
      name: `appstudio-import-${id}`,
      ns: namespace,
      ...(dryRun && { queryParams: { dryRun: 'All' } }),
    },
    resource: requestData,
  });

  return binding;
};

/**
 * Create SPIAccessTokenBinding if a binding with the same Git URL & permissins
 * does not already exist.
 * Else return the existing SPIAccessTokenBinding.
 *
 * @param url the URL of the git repository
 * @param namespace namespace to create the binding
 * @returns Returns the SPIAccessTokenBinding resource
 */
export const initiateAccessTokenBinding = async (url: string, namespace: string) => {
  const bindings: SPIAccessTokenBindingKind[] = await k8sListResourceItems({
    model: SPIAccessTokenBindingModel,
    queryOptions: {
      ns: namespace,
    },
  });
  const binding = bindings.find(
    (b) =>
      b.spec.repoUrl === url &&
      isEqual(b.spec.permissions, {
        required: [
          { type: 'r', area: 'repository' },
          { type: 'w', area: 'repository' },
        ],
      }),
  );
  if (binding) {
    return binding;
  }

  return createAccessTokenBinding(url, namespace);
};

export const createSupportedPartnerSecret = async (
  partnerTask: PartnerTask,
  secret: ImportSecret,
  namespace: string,
  dryRun: boolean,
) => {
  const spiTokenName = SNYK_SPI_TOKEN_ACCESS_BINDING;
  const resourcePromises = [];
  const secretName = `tmp-upload-secret-`;
  const secretResource = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      generateName: secretName,
      namespace,
      labels: {
        'spi.appstudio.redhat.com/upload-secret': 'token',
        'spi.appstudio.redhat.com/token-name': spiTokenName,
      },
    },
    type: 'Opaque',
    data: {},
    stringData: {
      spiTokenName,
      userName: 'my-username', // username field is a required field, so any random name needs to be passed.
      providerUrl: partnerTask.providerUrl,
      tokenData: secret.keyValues.find((s) => s.key === partnerTask.tokenKeyName)?.value || '',
    },
  };

  resourcePromises.push(createSecretResource(secretResource, namespace, dryRun));

  const spiAccessTokenBinding = {
    apiVersion: `${SPIAccessTokenBindingModel.apiGroup}/${SPIAccessTokenBindingModel.apiVersion}`,
    kind: SPIAccessTokenBindingModel.kind,
    metadata: {
      name: `spi-access-token-binding-for-${secret.secretName}`,
      namespace,
    },
    spec: {
      repoUrl: partnerTask.providerUrl,
      lifetime: '-1',
      secret: {
        type: 'Opaque',
        name: secret.secretName,
        fields: {
          token: partnerTask.tokenKeyName,
        },
        linkedTo: [
          {
            serviceAccount: {
              reference: {
                name: PIPELINE_SERVICE_ACCOUNT,
              },
            },
          },
        ],
      },
    },
  };

  resourcePromises.push(
    k8sCreateResource({
      model: SPIAccessTokenBindingModel,
      queryOptions: {
        name: spiAccessTokenBinding.metadata.name,
        ns: namespace,
        ...(dryRun && { queryParams: { dryRun: 'All' } }),
      },
      resource: spiAccessTokenBinding,
    }),
  );
  return Promise.all(resourcePromises);
};

export const createSecret = async (
  secret: ImportSecret,
  workspace: string,
  namespace: string,
  dryRun: boolean,
) => {
  const partnerTask = Object.values(supportedPartnerTasksSecrets).find(
    (s) => s.name === secret.secretName,
  );
  if (partnerTask) {
    return createSupportedPartnerSecret(partnerTask, secret, namespace, dryRun);
  }
  const secretResource = {
    apiVersion: SecretModel.apiVersion,
    kind: SecretModel.kind,
    metadata: {
      name: secret.secretName,
      namespace,
    },
    type: 'Opaque',
    data: {},
    stringData: secret.keyValues.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {}),
  };
  //Todo: K8sCreateResource appends the resource name and errors out.
  // Fix the below code when this sdk-utils issue is resolved https://issues.redhat.com/browse/RHCLOUD-21655.
  return commonFetch(
    `/workspaces/${workspace}/api/v1/namespaces/${namespace}/secrets${dryRun ? '?dryRun=All' : ''}`,
    {
      method: 'POST',
      body: JSON.stringify(secretResource),
      headers: { 'Content-type': 'application/json' },
    },
  );
};
