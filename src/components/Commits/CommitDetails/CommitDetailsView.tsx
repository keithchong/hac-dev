import React from 'react';
import { Bullseye, Spinner, Text, TextVariants } from '@patternfly/react-core';
import { usePipelineRunsForCommit } from '../../../hooks/usePipelineRuns';
import { PipelineRunGroupVersionKind } from '../../../models';
import { HttpError } from '../../../shared/utils/error/http-error';
import { useApplicationBreadcrumbs } from '../../../utils/breadcrumb-utils';
import { getCommitShortName, getLatestCommitFromPipelineRuns } from '../../../utils/commits-utils';
import { runStatus } from '../../../utils/pipeline-utils';
import { useWorkspaceInfo } from '../../../utils/workspace-context-utils';
import DetailsPage from '../../ApplicationDetails/DetailsPage';
import ErrorEmptyState from '../../EmptyState/ErrorEmptyState';
import SidePanelHost from '../../SidePanel/SidePanelHost';
import { StatusIconWithTextLabel } from '../../topology/StatusIcon';
import { useCommitStatus } from '../commit-status';
import { CommitIcon } from '../CommitIcon';
import CommitOverviewTab from '../tabs/CommitOverviewTab';
import CommitsPipelineRunTab from '../tabs/CommitsPipelineRunTab';

import './CommitDetailsView.scss';

type CommitDetailsViewProps = {
  applicationName: string;
  commitName: string;
};

export const COMMITS_GS_LOCAL_STORAGE_KEY = 'commits-getting-started-modal';

const CommitDetailsView: React.FC<CommitDetailsViewProps> = ({ commitName, applicationName }) => {
  const { namespace, workspace } = useWorkspaceInfo();
  const applicationBreadcrumbs = useApplicationBreadcrumbs();

  const [pipelineruns, loaded, loadErr] = usePipelineRunsForCommit(
    namespace,
    applicationName,
    commitName,
  );

  const commit = React.useMemo(
    () =>
      loaded &&
      Array.isArray(pipelineruns) &&
      pipelineruns.length > 0 &&
      getLatestCommitFromPipelineRuns(pipelineruns),
    [loaded, pipelineruns],
  );

  const [commitStatus] = useCommitStatus(applicationName, commitName);

  const commitDisplayName = getCommitShortName(commitName);

  if (loadErr || (loaded && !commit)) {
    return (
      <ErrorEmptyState
        httpError={HttpError.fromCode(loadErr ? (loadErr as any).code : 404)}
        title={`Could not load ${PipelineRunGroupVersionKind.kind}`}
        body={(loadErr as any)?.message ?? 'Not found'}
      />
    );
  }

  if (!commit) {
    return (
      <Bullseye>
        <Spinner data-test="spinner" />
      </Bullseye>
    );
  }
  return (
    <SidePanelHost>
      <DetailsPage
        headTitle={commitDisplayName}
        breadcrumbs={[
          ...applicationBreadcrumbs,
          {
            path: `/application-pipeline/workspaces/${workspace}/applications/${applicationName}/activity/latest-commits`,
            name: 'commits',
          },
          {
            path: `/application-pipeline/workspaces/${workspace}/applications/${applicationName}/commit/${commitName}`,
            name: commitDisplayName,
          },
        ]}
        title={
          <Text component={TextVariants.h2}>
            <span className="pf-u-mr-sm">
              <CommitIcon isPR={commit.isPullRequest} className="commit-details__title-icon" />{' '}
              <b>{commit.shaTitle}</b>
            </span>
            <StatusIconWithTextLabel status={commitStatus as runStatus} />
          </Text>
        }
        actions={[
          {
            key: 'go-to-source',
            label: 'Go to source',
            onClick: () => window.open(commit.shaURL),
          },
        ]}
        baseURL={`/application-pipeline/workspaces/${workspace}/applications/${applicationName}/commit/${commitName}`}
        tabs={[
          {
            key: 'details',
            label: 'Details',
            isFilled: true,
            component: <CommitOverviewTab commit={commit} commitStatus={commitStatus} />,
          },
          {
            key: 'pipelineruns',
            label: 'Pipeline runs',
            component: (
              <CommitsPipelineRunTab
                pipelineRuns={pipelineruns}
                applicationName={applicationName}
              />
            ),
          },
        ]}
      />
    </SidePanelHost>
  );
};

export default CommitDetailsView;
