import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bullseye,
  Button,
  ButtonVariant,
  EmptyStateBody,
  EmptyStateSecondaryActions,
  InputGroup,
  Spinner,
  Text,
  TextContent,
  TextInput,
  TextVariants,
  Title,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { FilterIcon } from '@patternfly/react-icons/dist/js/icons';
import { useIntegrationTestScenarios } from '../../../hooks/useIntegrationTestScenarios';
import { useSearchParam } from '../../../hooks/useSearchParam';
import emptyStateImgUrl from '../../../imgs/Integration-test.svg';
import { IntegrationTestScenarioModel } from '../../../models';
import { Table } from '../../../shared';
import { IntegrationTestScenarioKind } from '../../../types/coreBuildService';
import { useAccessReviewForModel } from '../../../utils/rbac';
import { useWorkspaceInfo } from '../../../utils/workspace-context-utils';
import { ButtonWithAccessTooltip } from '../../ButtonWithAccessTooltip';
import AppEmptyState from '../../EmptyState/AppEmptyState';
import FilteredEmptyState from '../../EmptyState/FilteredEmptyState';
import { IntegrationTestListHeader } from './IntegrationTestListHeader';
import IntegrationTestListRow from './IntegrationTestListRow';

type IntegrationTestsListViewProps = {
  applicationName: string;
};

const IntegrationTestsEmptyState: React.FC<{
  handleAddTest: () => void;
  canCreateIntegrationTest: boolean;
}> = ({ handleAddTest, canCreateIntegrationTest }) => {
  return (
    <AppEmptyState
      data-test="integration-tests__empty"
      emptyStateImg={emptyStateImgUrl}
      title="Test any code changes"
    >
      <EmptyStateBody>
        Integration tests run in parallel, validating each new component build with the latest
        version of all other application components.
        <br />
        To add an integration test, link to a GitHub repository containing code that can test how
        your application components work together.
      </EmptyStateBody>
      <EmptyStateSecondaryActions>
        <ButtonWithAccessTooltip
          variant={ButtonVariant.primary}
          onClick={handleAddTest}
          isDisabled={!canCreateIntegrationTest}
          tooltip="You don't have access to add an integration test"
          data-test="add-integration-test"
        >
          Add integration test
        </ButtonWithAccessTooltip>
      </EmptyStateSecondaryActions>
    </AppEmptyState>
  );
};

const IntegrationTestsListView: React.FC<IntegrationTestsListViewProps> = ({ applicationName }) => {
  const { namespace, workspace } = useWorkspaceInfo();
  const [canCreateIntegrationTest] = useAccessReviewForModel(
    IntegrationTestScenarioModel,
    'create',
  );

  const navigate = useNavigate();
  const [integrationTests, integrationTestsLoaded] = useIntegrationTestScenarios(
    namespace,
    applicationName,
  );
  const [nameFilter, setNameFilter] = useSearchParam('name', '');

  const applicationIntegrationTests = React.useMemo(
    () =>
      integrationTestsLoaded
        ? integrationTests?.filter((test) => test.spec.application === applicationName)
        : [],
    [integrationTests, applicationName, integrationTestsLoaded],
  );

  const filteredIntegrationTests = React.useMemo(
    () =>
      nameFilter
        ? applicationIntegrationTests.filter(
            (test) => test.metadata.name.indexOf(nameFilter) !== -1,
          )
        : applicationIntegrationTests,
    [nameFilter, applicationIntegrationTests],
  );

  const handleAddTest = React.useCallback(() => {
    navigate(
      `/application-pipeline/workspaces/${workspace}/applications/${applicationName}/integrationtests/add`,
    );
  }, [navigate, applicationName, workspace]);

  const loading = (
    <Bullseye className="pf-u-mt-md" data-test="integration-tests__loading">
      <Spinner />
    </Bullseye>
  );

  if (!integrationTestsLoaded) {
    return loading;
  }

  if (!applicationIntegrationTests?.length) {
    return (
      <IntegrationTestsEmptyState
        handleAddTest={handleAddTest}
        canCreateIntegrationTest={canCreateIntegrationTest}
      />
    );
  }
  const onClearFilters = () => setNameFilter('');
  const onNameInput = (name: string) => setNameFilter(name);

  return (
    <>
      <Title headingLevel="h3" className="pf-u-mt-lg pf-u-mb-sm">
        Integration tests
      </Title>
      <TextContent>
        <Text component={TextVariants.p}>
          Add an integration test to test all your components after you commit code.
        </Text>
      </TextContent>
      <>
        <Toolbar data-testid="component-list-toolbar" clearAllFilters={onClearFilters}>
          <ToolbarContent>
            <ToolbarGroup alignment={{ default: 'alignLeft' }}>
              <ToolbarItem>
                <InputGroup>
                  <Button variant="control">
                    <FilterIcon /> Name
                  </Button>
                  <TextInput
                    name="nameInput"
                    data-test="name-input-filter"
                    type="search"
                    aria-label="name filter"
                    placeholder="Filter by name..."
                    onChange={(name) => onNameInput(name)}
                    value={nameFilter}
                  />
                </InputGroup>
              </ToolbarItem>
              <ToolbarItem>
                <ButtonWithAccessTooltip
                  variant={ButtonVariant.secondary}
                  onClick={handleAddTest}
                  isDisabled={!canCreateIntegrationTest}
                  tooltip="You don't have access to add an integration test"
                  data-test="add-integration-test"
                >
                  Add integration test
                </ButtonWithAccessTooltip>
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
        {filteredIntegrationTests.length ? (
          <Table
            data-test="integration-tests__table"
            data={filteredIntegrationTests}
            aria-label="Integration tests"
            Header={IntegrationTestListHeader}
            Row={IntegrationTestListRow}
            loaded
            getRowProps={(obj: IntegrationTestScenarioKind) => ({
              id: obj.metadata.name,
            })}
          />
        ) : (
          <FilteredEmptyState onClearFilters={onClearFilters} />
        )}
      </>
    </>
  );
};

export default IntegrationTestsListView;
